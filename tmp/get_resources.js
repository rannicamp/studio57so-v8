
import fs from 'fs';
const code = fs.readFileSync('components/configuracoes/PermissionManager.js', 'utf8');
const match = code.match(/const defaultRecursos = (\[[\s\S]*?\]);/);
if (match) console.log(match[1]);
else console.log('Not found');

