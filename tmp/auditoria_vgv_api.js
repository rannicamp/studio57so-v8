require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function runSQL() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
     console.log("Estabelecendo conexão via Supabase SDK...");
     
     const { data: emps } = await supabase.from('empreendimentos').select('id, nome');
     const { data: contratos } = await supabase.from('contratos').select('id, empreendimento_id, produto_id, valor_final_venda, status_contrato, tipo_documento').eq('status_contrato', 'Assinado');
     const { data: produtos } = await supabase.from('produtos_empreendimento').select('id, empreendimento_id, unidade, status, valor_venda_calculado');
     const { data: ligacoes } = await supabase.from('contrato_produtos').select('*');

     if (!contratos) {
         console.log("Contratos vazio"); return;
     }

     let markdown = "# Auditoria Financeira de VGV\n\n";

     markdown += "## 1. Contratos Assinados (Ativos e Reais)\n";
     markdown += "| ID | Empreendimento | Unidade | Tipo Documento | Valor Venda |\n";
     markdown += "|---|---|---|---|---|\n";
     contratos.filter(c => c.tipo_documento === 'CONTRATO').forEach(c => {
         const emp = emps.find(e => e.id === c.empreendimento_id)?.nome || 'Desconhecido';
         const p = ligacoes.find(l => l.contrato_id === c.id);
         const prod = p ? produtos.find(pr => pr.id === p.produto_id) : null;
         markdown += `| ${c.id} | ${emp} | ${prod ? prod.unidade : 'N/A'} | ${c.tipo_documento} | R$ ${(Number(c.valor_final_venda)).toLocaleString('pt-BR', {minimumFractionDigits: 2})} |\n`;
     });

     markdown += "\n## 2. Termos de Interesse (Ignorados pelo VGV)\n";
     markdown += "| ID | Empreendimento | Unidade | Tipo Documento | Valor Venda |\n";
     markdown += "|---|---|---|---|---|\n";
     contratos.filter(c => c.tipo_documento !== 'CONTRATO').forEach(c => {
         const emp = emps.find(e => e.id === c.empreendimento_id)?.nome || 'Desconhecido';
         const p = ligacoes.find(l => l.contrato_id === c.id);
         const prod = p ? produtos.find(pr => pr.id === p.produto_id) : null;
         markdown += `| ${c.id} | ${emp} | ${prod ? prod.unidade : 'N/A'} | ${c.tipo_documento} | R$ ${(Number(c.valor_final_venda)).toLocaleString('pt-BR', {minimumFractionDigits: 2})} |\n`;
     });

     markdown += "\n## 3. Unidades Disponíveis / Reservadas (Sem Contrato Efetivo)\n";
     markdown += "| Produto ID | Empreendimento | Unidade | Status | Valor de Tabela |\n";
     markdown += "|---|---|---|---|---|\n";
     
     const ligadosAContrato = ligacoes.filter(link => {
         return contratos.some(c => c.id === link.contrato_id && c.tipo_documento === 'CONTRATO');
     }).map(l => l.produto_id);

     produtos.forEach(p => {
         const temContrato = ligadosAContrato.includes(p.id);
         if (!temContrato && (p.status === 'Disponível' || p.status === 'Reservado' || p.status === 'Reservada')) {
             const emp = emps.find(e => e.id === p.empreendimento_id)?.nome || 'Desconhecido';
             markdown += `| ${p.id} | ${emp} | ${p.unidade} | ${p.status} | R$ ${(Number(p.valor_venda_calculado)).toLocaleString('pt-BR', {minimumFractionDigits: 2})} |\n`;
         }
     });

     fs.writeFileSync('C:\\\\Projetos\\\\studio57so-v8\\\\tmp\\\\auditoria_vgv.md', markdown);
     console.log("Artifact gerado.");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  }
}

runSQL();
