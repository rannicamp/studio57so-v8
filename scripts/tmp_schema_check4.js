const fs = require('fs');
const sql = fs.readFileSync('dbelo57.sql', 'utf8');
const getTable = (name) => {
  const start = sql.indexOf(`CREATE TABLE public.${name} (`);
  if (start === -1) return '';
  const t = sql.substring(start);
  return t.substring(0, t.indexOf(';')+1);
};
console.log(getTable('empreendimento_documento_embeddings'));
console.log(getTable('produtos_empreendimento'));
