import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: contas } = await supabase.from('contas_financeiras').select('id, nome').eq('tipo', 'Cartão de Crédito');
  const ids = contas.map(c => c.id);
  
  const { data: lancamentos } = await supabase
    .from('lancamentos')
    .select('id, data_transacao, descricao, valor, fatura_id, transferencia_id, conta_id, contas_financeiras!inner(nome), categorias_financeiras(nome)')
    .in('conta_id', ids)
    .eq('tipo', 'Receita')
    .order('data_transacao', { ascending: false });

  // Group by category
  const groups = {};
  lancamentos.forEach(d => {
    const cat = d.categorias_financeiras?.nome || 'Nenhuma Categoria';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(d);
  });

  let md = '# Auditoria: Entradas no Cartão de Crédito por Categoria\n\nAnalise detalhada de todos os créditos (lançamentos do tipo Receita) recebidos nas contas de Cartão, agrupados sistematicamente por categoria contábil.\n\n';

  // Sort groups by size (largest first)
  const sortedCategories = Object.keys(groups).sort((a,b) => groups[b].length - groups[a].length);

  sortedCategories.forEach(cat => {
    md += `## Categoria: ${cat} (${groups[cat].length} registros)\n\n`;
    md += '| Data | Cartão | Lançamento ID | Fatura Paga ID | Transf. ID | Valor (R$) | Descrição |\n';
    md += '|---|---|---|---|---|---|---|\n';
    
    groups[cat].forEach(d => {
      const dt = new Date(d.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR');
      const nomeCartao = d.contas_financeiras.nome.replace('0 - CARTÃO - ', '').trim();
      const valorFmt = parseFloat(d.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
      const desc = d.descricao.replace(/Tranf\\. de \\d+ - SICOOB [^:]+: /, '').substring(0, 40) + (d.descricao.length > 40 ? '...' : '');
      const hasTransf = d.transferencia_id ? 'Sim' : 'Não';
      const faturaId = d.fatura_id ? `\`#${d.fatura_id}\`` : '*Nula*';
      
      md += `| ${dt} | ${nomeCartao} | \`#${d.id}\` | **${faturaId}** | ${hasTransf} | **R$ ${valorFmt}** | ${desc} |\n`;
    });
    md += '\n---\n\n';
  });

  fs.writeFileSync('tmp/auditoria_all_cats.md', md);
}

run();
