require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     await client.connect();
     
     // 1. Procurar a área padrão de garagens (> 0)
     const resArea = await client.query(`
        SELECT area_m2, count(*) as c 
        FROM produtos_empreendimento 
        WHERE (nome ILIKE '%garagem%' OR nome ILIKE '%vaga%' OR tipo ILIKE '%garagem%') AND area_m2 > 0
        GROUP BY area_m2 
        ORDER BY c DESC 
        LIMIT 1
     `);
     
     if(resArea.rows.length === 0) {
        console.error(JSON.stringify({ error: "Não foi possível determinar a área padrão das garagens." }));
        return;
     }
     const padraoArea = resArea.rows[0].area_m2;

     // 2. Localizar todas as garagens com 0
     const resZeras = await client.query(`
         SELECT id, nome, empreendimento_id, area_m2 
         FROM produtos_empreendimento 
         WHERE (nome ILIKE '%garagem%' OR nome ILIKE '%vaga%' OR tipo ILIKE '%garagem%') 
         AND (area_m2 = 0 OR area_m2 IS NULL)
     `);

     const garagensParaAtualizar = resZeras.rows;
     
     // 3. Atualizar
     const idsAgrupados = garagensParaAtualizar.map(g => g.id);
     
     if (idsAgrupados.length > 0) {
        await client.query(`
            UPDATE produtos_empreendimento 
            SET area_m2 = $1 
            WHERE id = ANY($2::int[])
        `, [padraoArea, idsAgrupados]);
     }

     // Imprimir saída para o bot ler e compilar no artefato
     console.log(JSON.stringify({
         padraoInjetado: padraoArea,
         totalAtualizado: idsAgrupados.length,
         garagens: garagensParaAtualizar
     }));
     
  } catch(e) {
     console.error(JSON.stringify({ error: e.message }));
  } finally {
     await client.end();
  }
}

runSQL();
