const fs = require('fs');
const file = fs.readFileSync('dbelo57.sql', 'utf8');

const getTable = (name) => {
  const start = file.indexOf(`CREATE TABLE public.${name} (`);
  if (start === -1) return `Table ${name} not found`;
  const t = file.substring(start);
  return t.substring(0, t.indexOf(';')+1);
}

console.log(getTable('regras_notificacao'));
console.log(getTable('usuarios'));
console.log(getTable('cargos'));
console.log(getTable('notification_subscriptions'));
