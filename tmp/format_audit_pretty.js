import fs from 'fs';

const report = JSON.parse(fs.readFileSync('tmp/audit_report.json', 'utf8'));
const knownResources = [
  'empresas', 'empreendimentos', 'funcionarios', 'atividades',
  'rdo', 'usuarios', 'permissoes', 'financeiro', 'ponto',
  'orcamento', 'pedidos', 'crm', 'contatos', 'simulador',
  'contratos', 'caixa_de_entrada', 'anuncios', 'dashboard', 'funil'
];

let md = '# 🛡️ Relatório Oficial de Auditoria de Segurança\n\n';
md += '> [!NOTE]\n> **Objetivo:** Este documento cruza as regras de permissões exigidas no código-fonte com as tabelas do banco de dados, mapeando a atual superfície de ataque e identificando possíveis vazamentos de dados entre usuários.\n\n';

md += '## 🎯 1. Cobertura de Recursos Oficiais\n\n';
md += 'Análise dos 19 recursos homologados pelo sistema e onde eles estão protegendo as rotas e botões.\n\n';

const covered = [];
const uncovered = [];

for (const res of knownResources) {
  const usages = report.resources[res] || [];
  if (usages.length === 0) {
    uncovered.push(res);
  } else {
    const files = [...new Set(usages.map(u => u.file.replace(/\\\\/g, '/').split('studio57so-v8/')[1] || u.file.split('\\\\').pop()))];
    const actions = [...new Set(usages.map(u => u.action))];
    covered.push({ res, files, actions });
  }
}

md += '### ✅ Recursos Ativos e Protegendo Telas\n';
md += '| Recurso | Telas & Componentes Vigiados | Trava Exigida |\n';
md += '|---|---|---|\n';
covered.forEach(c => {
  md += `| **${c.res}** | ${c.files.map(f => `\`${f}\``).join('<br>')} | ${c.actions.map(a => `\`${a}\``).join(' ')} |\n`;
});

md += '\n### ⚠️ Recursos Órfãos (Risco de Inutilidade)\n';
md += '> [!WARNING]\n> Os seguintes recursos existem no painel de configurações, mas **nenhum** arquivo do sistema está validando essas chaves. Se um usuário tiver essa permissão, ela não serve para nada atualmente.\n\n';
md += uncovered.map(r => `- **${r}**`).join('\n') + '\n\n';

// Find undocumented resources
const unknownResources = Object.keys(report.resources).filter(r => !knownResources.includes(r));
if (unknownResources.length > 0) {
  md += '## 🚨 Gaps Críticos: Recursos Fantasmas\n';
  md += '> [!CAUTION]\n> Os arquivos abaixo estão bloqueando o acesso de usuários baseados em permissões que **não existem** no banco de dados. Isso significa que usuários comuns nunca poderão acessar essas áreas.\n\n';
  for (const res of unknownResources) {
    const usages = report.resources[res] || [];
    const files = [...new Set(usages.map(u => u.file.replace(/\\\\/g, '/').split('studio57so-v8/')[1] || u.file.split('\\\\').pop()))];
    md += `- 🛑 **${res}** bloqueando acesso em: ${files.map(f => `\`${f}\``).join(', ')}\n`;
  }
}

md += '\n## 🗄️ 2. Mapeamento de Conexões de Banco de Dados\n\n';
md += '> [!TIP]\n> Para garantir 100% de segurança, verifique se os arquivos listados abaixo possuem a trava `hasPermission` na renderização visual. Se um arquivo altera uma tabela e não possui a trava, temos um **vazamento de front-end**.\n\n';

for (const tab of Object.keys(report.tables).sort()) {
  const files = [...new Set(report.tables[tab].map(f => f.replace(/\\\\/g, '/').split('studio57so-v8/')[1] || f.split('\\\\').pop()))];
  md += `#### Tabela: \`${tab}\`\n`;
  files.forEach(f => {
    md += `- \`${f}\`\n`;
  });
  md += '\n';
}

fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/c5ca0557-53db-4f54-9cc7-5cfef36ecc8f/relatorio_auditoria_permissoes.md', md);
fs.writeFileSync('c:/Projetos/studio57so-v8/relatorio_auditoria_permissoes.md', md);
console.log('Artifact created and updated');
