const fs = require('fs');
let file = fs.readFileSync('dbelo57.sql');
// Identificar se é UTF16LE baseando em BOM (FF FE)
if (file[0] === 0xFF && file[1] === 0xFE) {
  file = file.toString('utf16le');
} else {
  file = file.toString('utf8');
}

const tablePattern = /CREATE TABLE public\.(\w+)/;
const tables = {};
let currentTable = null;

const lines = file.split('\n');
for (let line of lines) {
  line = line.trim();
  const tableMatch = line.match(tablePattern);
  if (tableMatch) {
    currentTable = tableMatch[1];
    tables[currentTable] = [];
  } else if (currentTable && line.includes('contato_id')) {
     const colMatch = line.match(/^([a-zA-Z0-9_]+_contato_id|contato_id)\s+/);
     if (colMatch) {
         tables[currentTable].push(colMatch[1]);
     }
  }
}

for (const [table, cols] of Object.entries(tables)) {
  if (cols.length > 0) {
    console.log(`Tabela: ${table} => Colunas: ${cols.join(', ')}`);
  }
}
