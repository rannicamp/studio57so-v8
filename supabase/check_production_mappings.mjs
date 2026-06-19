import pg from 'pg';
const { Client } = pg;

const ELO_URL = 'postgresql://postgres:Srbr19010720%40@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
  const c = new Client({ connectionString: decodeURIComponent(ELO_URL), ssl: SSL });
  try {
    await c.connect();
    console.log('📡 Conectado ao banco do ELO 57 (Produção)...');
    
    const { rows } = await c.query(
      "SELECT id, propriedade_nome, categoria_bim, familia_bim, tipo_bim, tipo_vinculo, escopo, material_id, sinapi_id, organizacao_id, fator_conversao FROM public.bim_mapeamentos_propriedades ORDER BY id"
    );
    
    console.log(`\nTotal de mapeamentos em Produção: ${rows.length}`);
    rows.forEach(m => {
      console.log(`ID: ${m.id} | Org: ${m.organizacao_id} | Escopo: ${m.escopo} | Categoria: ${m.categoria_bim} | Família: ${m.familia_bim} | Tipo: ${m.tipo_bim}`);
      console.log(`  Prop: ${m.propriedade_nome} | MaterialID: ${m.material_id} | SinapiID: ${m.sinapi_id} | Fator: ${m.fator_conversao}`);
      console.log('----------------------------------------------------');
    });

  } catch (err) {
    console.error('Erro de conexão:', err);
  } finally {
    await c.end();
  }
}

run();
