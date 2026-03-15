const fs = require('fs');
const data = JSON.parse(fs.readFileSync('supabase/functions.json', 'utf8'));

console.log("=== FUNCTIONS COM 'status_execucao' ou 'atividade' ===");
let count = 0;
for (const fn of data) {
    const bodyStr = fn.body || '';
    if (bodyStr.includes('status_execucao') || bodyStr.includes('atividades_elementos')) {
        console.log(`\n--- FUNC/TRIGGER: ${fn.name} ---`);
        console.log(bodyStr.substring(0, 500) + '...');
        count++;
    }
}
if(count === 0) console.log("Nenhuma encontrada.");
