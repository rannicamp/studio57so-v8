
const fs = require('fs');
const path = require('path');

function getPages(dir, baseRoute = '') {
  let pages = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      pages = pages.concat(getPages(fullPath, baseRoute + '/' + file));
    } else if (file === 'page.js' || file === 'page.jsx') {
      pages.push({ route: baseRoute || '/', file: fullPath });
    }
  }
  return pages;
}

const allPages = getPages('app/(main)');

let reportData = { tables: {} };
try {
  reportData = JSON.parse(fs.readFileSync('tmp/audit_report.json', 'utf8'));
} catch (e) {
  console.log('No audit report found');
}

const modules = [
  { name: 'Administrativo', routes: ['/painel', '/financeiro', '/recursos-humanos', '/empresas', '/empreendimentos', '/contratos', '/relatorios'] },
  { name: 'Comercial', routes: ['/caixa-de-entrada', '/crm', '/comercial', '/contatos', '/simulador-financiamento'] },
  { name: 'Obra', routes: ['/orcamento', '/pedidos', '/almoxarifado', '/rdo', '/atividades'] },
  { name: 'Coordenação BIM', routes: ['/bim-manager'] },
  { name: 'Configurações', routes: ['/configuracoes', '/admin'] }
];

let md = '# 🗺️ Catálogo de Arquitetura do Sistema\n\n';

md += '## Parte 1: Árvore do Explorer (Módulos e Subpáginas)\n\n';

const groupedPages = {};

modules.forEach(mod => {
  md += '### ' + mod.name + '\n';
  groupedPages[mod.name] = [];
  
  mod.routes.forEach(baseRoute => {
    const matchingPages = allPages.filter(p => p.route === baseRoute || p.route.startsWith(baseRoute + '/'));
    
    matchingPages.sort((a,b) => a.route.localeCompare(b.route)).forEach(p => {
      groupedPages[mod.name].push(p);
      const depth = p.route.split('/').length - 2;
      const indent = '  '.repeat(Math.max(0, depth));
      md += indent + '- ' + p.route + '\n';
    });
  });
  md += '\n';
});

md += '## Parte 2: Acesso ao Banco de Dados por Rota\n\n';

const routeMappings = {
  '/financeiro': ['components/financeiro', 'app/(main)/financeiro'],
  '/recursos-humanos': ['components/rh', 'app/(main)/recursos-humanos', 'app/(main)/funcionarios'],
  '/empresas': ['components/empresas', 'app/(main)/empresas'],
  '/empreendimentos': ['components/empreendimentos', 'app/(main)/empreendimentos'],
  '/contratos': ['components/contratos', 'app/(main)/contratos'],
  '/caixa-de-entrada': ['components/whatsapp', 'app/(main)/caixa-de-entrada'],
  '/crm': ['components/crm', 'app/(main)/crm'],
  '/contatos': ['components/contatos', 'app/(main)/contatos'],
  '/simulador-financiamento': ['components/simuladores', 'app/(main)/simulador-financiamento'],
  '/orcamento': ['components/orcamento', 'app/(main)/orcamento', 'components/bim'],
  '/pedidos': ['components/pedidos', 'app/(main)/pedidos'],
  '/almoxarifado': ['components/almoxarifado', 'app/(main)/almoxarifado'],
  '/rdo': ['components/rdo', 'app/(main)/rdo'],
  '/atividades': ['components/atividades', 'app/(main)/atividades'],
  '/bim-manager': ['components/bim', 'app/(main)/bim-manager'],
  '/configuracoes': ['components/configuracoes', 'app/(main)/configuracoes'],
  '/relatorios': ['app/(main)/relatorios']
};

const tablesUsedInModule = {};

Object.keys(reportData.tables).forEach(table => {
  const filesUsingTable = reportData.tables[table];
  
  filesUsingTable.forEach(file => {
    // Normalize path
    const normalizedFile = file.replace(/\\\\/g, '/');
    
    let assigned = false;
    for (const [route, searchPaths] of Object.entries(routeMappings)) {
      if (searchPaths.some(p => normalizedFile.includes(p))) {
        if (!tablesUsedInModule[route]) tablesUsedInModule[route] = new Set();
        tablesUsedInModule[route].add(table);
        assigned = true;
        break;
      }
    }
  });
});

for (const mod of modules) {
  md += '### ' + mod.name + '\n';
  mod.routes.forEach(route => {
    const tables = tablesUsedInModule[route];
    if (tables && tables.size > 0) {
      md += '**' + route + '**\n';
      md += '- Tabelas: ' + Array.from(tables).sort().join(', ') + '\n\n';
    } else {
      md += '**' + route + '**\n';
      md += '- Tabelas: *Não detectado diretamente*\n\n';
    }
  });
}

// Copy to workspace for easy opening
fs.writeFileSync('c:/Projetos/studio57so-v8/catalogo_arquitetura.md', md, 'utf8');

// Copy to Brain to trigger artifact!
fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/c5ca0557-53db-4f54-9cc7-5cfef36ecc8f/catalogo_arquitetura.md', md, 'utf8');

console.log('Done');

