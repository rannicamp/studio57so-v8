// scratch/listar_arquivos_storage.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listDir(path = '') {
  console.log(`\nListando diretório: "${path}"...`);
  const { data: files, error } = await supabase
    .storage
    .from('empreendimento-anexos')
    .list(path);

  if (error) {
    console.error(`Erro ao listar "${path}":`, error.message);
    return;
  }

  if (files && files.length > 0) {
    for (const f of files) {
      const fullPath = path ? `${path}/${f.name}` : f.name;
      // No Supabase, pastas vêm com metadata: null ou vazias
      const isDir = !f.id || f.metadata === null || Object.keys(f.metadata).length === 0;
      if (isDir) {
        console.log(` [DIR] ${fullPath}`);
        await listDir(fullPath);
      } else {
        console.log(` [FILE] ${fullPath} (${(f.metadata?.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
  }
}

async function main() {
  await listDir('');
}

main().catch(console.error);
