// scratch/filtrar_log.js
const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\ranni\\.gemini\\antigravity\\brain\\0254b46f-ded9-44e2-9d20-658a8e0cad55\\.system_generated\\tasks\\task-2798.log';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  console.log("=== ARQUIVOS NO DIRETÓRIO 5/ (BETA SUÍTES) ===");
  const filtered = lines.filter(l => l.includes('5/'));
  
  filtered.forEach(l => console.log(l));
  
} catch (e) {
  console.error("Erro ao ler log:", e.message);
}
