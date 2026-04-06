const { Client } = require('pg');
const fs = require('fs');

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function runSQL() {
  const client = new Client({
      connectionString: decodeURIComponent(STUDIO_URL),
      ssl: SSL
  });
  
  try {
     const functions = JSON.parse(fs.readFileSync('functions.json', 'utf8'));
     const unificarDef = functions['unificar_materiais'];
     
     console.log("Estabelecendo link oficial para corrigir unificar_materiais...");
     await client.connect();
     
     // Drop wrong versions
     await client.query(`DROP FUNCTION IF EXISTS public.unificar_materiais(uuid, uuid) CASCADE;`);
     await client.query(`DROP FUNCTION IF EXISTS public.unificar_materiais(p_origem_id uuid, p_destino_id uuid) CASCADE;`);
     
     const createRpcSql = `
CREATE OR REPLACE FUNCTION public.unificar_materiais(old_material_id uuid, new_material_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
${unificarDef}
$$;
     `;
     await client.query(createRpcSql);

     console.log("✅ Função restaurada com os Nomes de Parâmetros Corretos!");
  } catch(e) {
     console.error("❌ FALHA:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
