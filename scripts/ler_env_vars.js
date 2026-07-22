// scripts/ler_env_vars.js
require('dotenv').config({ path: '.env.local' });

console.log("--- CONFIGURAÇÃO DE AMBIENTE ---");
const keys = Object.keys(process.env);
for (const key of keys) {
  if (key.includes('SUPABASE') || key.includes('DB') || key.includes('POSTGRES')) {
    const val = process.env[key];
    console.log(`${key}: ${val ? `Configurada (comprimento: ${val.length})` : 'Vazia'}`);
  }
}
