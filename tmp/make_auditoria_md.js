const fs = require('fs');

const data = JSON.parse(fs.readFileSync('tmp/todas_transferencias_cartao.json', 'utf8'));

let md = '# Auditoria: Pagamentos de Cartão (Transferências)\n\nLista em ordem cronológica reversa dos lançamentos que são Pagamentos da Fatura (origem noutra conta).\n\n';
md += '| Data | Cartão | Valor (R$) | Lançamento ID | Fatura Paga ID | Descrição |\n';
md += '|---|---|---|---|---|---|\n';

data.forEach(d => {
  const dt = new Date(d.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR');
  const nomeCartao = d.contas_financeiras.nome.replace('0 - CARTÃO - ', '').trim();
  const valorFmt = parseFloat(d.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
  const desc = d.descricao.replace(/Tranf\. de \d+ - SICOOB [^:]+: /, '').substring(0, 40) + '...';
  
  md += `| ${dt} | ${nomeCartao} | **R$ ${valorFmt}** | \`#${d.id}\` | **\`#${d.fatura_id}\`** | ${desc} |\n`;
});

fs.writeFileSync('tmp/auditoria_caso_a_caso.md', md);
