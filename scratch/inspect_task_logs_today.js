// scratch/inspect_task_logs_today.js
const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/ranni/.gemini/antigravity/brain/0254b46f-ded9-44e2-9d20-658a8e0cad55/.system_generated/tasks/task-2224.log';

function main() {
  console.log("=== LENDO LOGS DO NEXT.JS DEV SERVER DE HOJE ===");
  
  if (!fs.existsSync(logPath)) {
    console.error("Arquivo de log não encontrado:", logPath);
    return;
  }

  const logContent = fs.readFileSync(logPath, 'utf-8');
  const lines = logContent.split('\n');
  console.log(`Total de linhas no log: ${lines.length}`);

  const targets = ['6127', '6124', 'Iris', 'Hudson', 'ia_atendimento_ativo', 'Desativando piloto', 'humano'];
  let count = 0;

  lines.forEach((line, idx) => {
    const matched = targets.some(t => line.toLowerCase().includes(t.toLowerCase()));
    if (matched) {
      console.log(`[Linha ${idx + 1}] ${line.trim()}`);
      count++;
    }
  });

  console.log(`\nTotal de linhas correspondentes: ${count}`);
}

main();
