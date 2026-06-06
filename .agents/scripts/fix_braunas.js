const fs = require('fs');

// Update SimuladorTabs.js
let tabsCode = fs.readFileSync('app/(corretor)/simuladores/SimuladorTabs.js', 'utf8');
tabsCode = tabsCode.replace('<SimuladorBraunas />', '<SimuladorBraunas empreendimentos={empreendimentos} />');
fs.writeFileSync('app/(corretor)/simuladores/SimuladorTabs.js', tabsCode);
console.log('SimuladorTabs.js updated');

// Update SimuladorBraunas.js
let braunasCode = fs.readFileSync('components/simuladores/SimuladorBraunas.js', 'utf8');
braunasCode = braunasCode.replace('export default function SimuladorBraunas() {', 'export default function SimuladorBraunas({ empreendimentos = [] }) {');
braunasCode = braunasCode.replace(
  'const empreendimentoFixo = { id: REFUGIO_BRAUNAS_ID, nome: REFUGIO_BRAUNAS_NOME };',
  'const empreendimentoFixo = empreendimentos.find(e => e.id === REFUGIO_BRAUNAS_ID) || { id: REFUGIO_BRAUNAS_ID, nome: REFUGIO_BRAUNAS_NOME };'
);
fs.writeFileSync('components/simuladores/SimuladorBraunas.js', braunasCode);
console.log('SimuladorBraunas.js updated');
