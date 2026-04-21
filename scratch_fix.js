const fs = require('fs');
let path2 = 'c:/Projetos/studio57so-v8/components/financeiro/LancamentoForm/FormCategorizacao.js';
let content2 = fs.readFileSync(path2, "utf8");
content2 = content2.replace("{ativosDisponiveis.map(a => (", "{patrimoniosDisponiveis.map(a => (");
fs.writeFileSync(path2, content2);
console.log("Fix aplicado!");
