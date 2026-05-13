import fs from 'fs';

const report = JSON.parse(fs.readFileSync('tmp/audit_report.json', 'utf8'));
const knownResources = [
  'empresas', 'empreendimentos', 'funcionarios', 'atividades',
  'rdo', 'usuarios', 'permissoes', 'financeiro', 'ponto',
  'orcamento', 'pedidos', 'crm', 'contatos', 'simulador',
  'contratos', 'caixa_de_entrada', 'anuncios', 'dashboard', 'funil'
];

let md = '# 🛡️ Relatório de Auditoria de Segurança e Permissões\n\n';
md += 'Este relatório cruza os **19 Recursos** cadastrados no sistema com os arquivos (Telas e Componentes) que exigem essas permissões, além de listar as tabelas do banco que estão sendo acessadas por esses arquivos.\n\n';

md += '## 1. Mapeamento de Recursos (O que está protegido)\n\n';
md += '| Recurso Oficial | Telas/Componentes Protegidos | Ações (`pode_ver`, `pode_editar`, etc) |\n';
md += '|---|---|---|\n';

for (const res of knownResources) {
  const usages = report.resources[res] || [];
  if (usages.length === 0) {
    md += `| ⚠️ **${res}** | *Nenhuma tela encontrada usando hasPermission* | - |\n`;
  } else {
    const files = [...new Set(usages.map(u => u.file.replace(/\\\\/g, '/').split('studio57so-v8/')[1] || u.file.split('\\\\').pop()))];
    const actions = [...new Set(usages.map(u => u.action))];
    md += `| ✅ **${res}** | ${files.join('<br>')} | ${actions.join(', ')} |\n`;
  }
}

// Find undocumented resources
const unknownResources = Object.keys(report.resources).filter(r => !knownResources.includes(r));
if (unknownResources.length > 0) {
  md += '\n### 🚨 Recursos Não Cadastrados Sendo Usados!\n';
  md += 'O código fonte está pedindo as seguintes permissões, mas elas NÃO EXISTEM na tela de configurações:\n\n';
  for (const res of unknownResources) {
    const usages = report.resources[res] || [];
    const files = [...new Set(usages.map(u => u.file.replace(/\\\\/g, '/').split('studio57so-v8/')[1] || u.file.split('\\\\').pop()))];
    md += `- **${res}** (Usado em: ${files.join(', ')})\n`;
  }
}

md += '\n## 2. Acesso a Tabelas (Onde o Banco é Tocado)\n\n';
md += 'Abaixo está a lista de tabelas acessadas via Supabase diretamente no Frontend. Se um componente acessa uma tabela mas **não** tem `hasPermission`, ele pode ser um **Vazamento**.\n\n';

md += '| Tabela | Arquivos Acessando (components/app) |\n';
md += '|---|---|\n';

for (const tab of Object.keys(report.tables).sort()) {
  const files = [...new Set(report.tables[tab].map(f => f.replace(/\\\\/g, '/').split('studio57so-v8/')[1] || f.split('\\\\').pop()))];
  md += `| ${tab} | ${files.join('<br>')} |\n`;
}

fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/c5ca0557-53db-4f54-9cc7-5cfef36ecc8f/relatorio_auditoria_permissoes.md', md);
console.log('Artifact created');
