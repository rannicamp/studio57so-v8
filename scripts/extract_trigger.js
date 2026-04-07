const fs = require('fs');
const data = JSON.parse(fs.readFileSync('functions.json', 'utf8'));
const funcs = Array.isArray(data) ? data : (data.functions || Object.values(data));
const matches = funcs.filter(f => JSON.stringify(f).includes('historico_lancamentos_financeiros'));
fs.writeFileSync('scripts/tmp_trigger.json', JSON.stringify(matches, null, 2));
