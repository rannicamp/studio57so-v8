// scratch/check_syntax.js
const fs = require('fs');
const code = fs.readFileSync('app/api/ai/stella/process/route.js', 'utf8');

let line = 1;
let col = 1;
let openBraces = [];

for (let i = 0; i < code.length; i++) {
  const char = code[i];
  if (char === '\n') {
    line++;
    col = 1;
  } else {
    col++;
  }

  if (char === '{') {
    openBraces.push({ line, col });
    console.log(`[ABRE] Linha ${line}, Col ${col} | Total abertas: ${openBraces.length}`);
  } else if (char === '}') {
    if (openBraces.length === 0) {
      console.error(`[ERRO] '}' extra encontrado na linha ${line}, col ${col}`);
    } else {
      const b = openBraces.pop();
      console.log(`[FECHA] Linha ${line}, Col ${col} | Fecha a chave da Linha ${b.line}, Col ${b.col} | Restam: ${openBraces.length}`);
    }
  }
}
