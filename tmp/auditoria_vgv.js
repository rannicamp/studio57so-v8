require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo conexão...");
     await client.connect();
     
     const resEmpresas = await client.query('SELECT id, nome FROM empreendimentos WHERE organizacao_id = 1');
     const emps = resEmpresas.rows;

     const resContratos = await client.query(`
        SELECT c.id, c.empreendimento_id, c.valor_final_venda, c.status_contrato, c.tipo_documento, e.nome as empreendimento_nome, p.unidade 
        FROM contratos c 
        LEFT JOIN empreendimentos e ON c.empreendimento_id = e.id 
        LEFT JOIN produtos_empreendimento p ON c.produto_id = p.id
        WHERE c.organizacao_id = 1 AND c.status_contrato = 'Assinado'
     `);
     
     const resProdutos = await client.query(`
        SELECT p.id, p.empreendimento_id, p.unidade, p.status, p.valor_venda_calculado, e.nome as empreendimento_nome 
        FROM produtos_empreendimento p 
        LEFT JOIN empreendimentos e ON p.empreendimento_id = e.id 
        WHERE p.organizacao_id = 1 
     `);

     const contratoAnexo = await client.query(`
        SELECT * FROM contrato_produtos WHERE organizacao_id = 1
     `);

     let markdown = "# Auditoria Financeira de VGV\n\n";

     markdown += "## 1. Contratos Assinados (Ativos e Reais)\n";
     markdown += "| ID | Empreendimento | Unidade | Tipo Documento | Valor Venda |\n";
     markdown += "|---|---|---|---|---|\n";
     resContratos.rows.filter(c => c.tipo_documento === 'CONTRATO').forEach(c => {
         markdown += `| ${c.id} | ${c.empreendimento_nome} | ${c.unidade || 'N/A'} | ${c.tipo_documento} | R$ ${(Number(c.valor_final_venda)).toLocaleString('pt-BR', {minimumFractionDigits: 2})} |\n`;
     });

     markdown += "\n## 2. Termos de Interesse (Ignorados pelo VGV)\n";
     markdown += "| ID | Empreendimento | Unidade | Tipo Documento | Valor Venda |\n";
     markdown += "|---|---|---|---|---|\n";
     resContratos.rows.filter(c => c.tipo_documento !== 'CONTRATO').forEach(c => {
         markdown += `| ${c.id} | ${c.empreendimento_nome} | ${c.unidade || 'N/A'} | ${c.tipo_documento} | R$ ${(Number(c.valor_final_venda)).toLocaleString('pt-BR', {minimumFractionDigits: 2})} |\n`;
     });

     markdown += "\n## 3. Unidades Disponíveis / Reservadas (Sem Contrato Efetivo)\n";
     markdown += "| Produto ID | Empreendimento | Unidade | Status | Valor de Tabela |\n";
     markdown += "|---|---|---|---|---|\n";
     
     const ligadosAContrato = contratoAnexo.rows.filter(link => {
         return resContratos.rows.some(c => c.id === link.contrato_id && c.tipo_documento === 'CONTRATO');
     }).map(l => l.produto_id.toString());

     resProdutos.rows.forEach(p => {
         const temContrato = ligadosAContrato.includes(p.id.toString());
         if (!temContrato && (p.status === 'Disponível' || p.status === 'Reservado' || p.status === 'Reservada')) {
             markdown += `| ${p.id} | ${p.empreendimento_nome} | ${p.unidade} | ${p.status} | R$ ${(Number(p.valor_venda_calculado)).toLocaleString('pt-BR', {minimumFractionDigits: 2})} |\n`;
         }
     });

     fs.writeFileSync('C:\\Users\\ranni\\.gemini\\antigravity\\brain\\62071bce-6d27-4aa4-b067-d97de1e6ae14\\artifacts\\auditoria_vgv.md', markdown);
     console.log("Artifact gerado.");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
