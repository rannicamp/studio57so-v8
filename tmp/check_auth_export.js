
import fs from 'fs';
const code = fs.readFileSync('contexts/AuthContext.js', 'utf8');
console.log(code.includes('organizacao_id'));

