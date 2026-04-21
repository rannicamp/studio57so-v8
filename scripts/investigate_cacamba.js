require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function checkCaçamba() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     await client.connect();
     
     // Find the material
     const matRes = await client.query("SELECT id, nome FROM materiais WHERE nome ILIKE '%Caçamba%'");
     console.log("Materiais encontrados:", matRes.rows);
     
     if (matRes.rows.length > 0) {
        const matId = matRes.rows[0].id;
        
        // Find orders containing this material
        const pciRes = await client.query(`
            SELECT 
                pci.id as item_id, 
                pci.pedido_id, 
                p.status,
                pci.tipo_operacao, 
                pci.quantidade
            FROM pedidos_compra_itens pci
            JOIN pedidos_compra p ON p.id = pci.pedido_id
            WHERE pci.material_id = $1
        `, [matId]);
        
        console.log("Itens de pedido de compra:", pciRes.rows);
        
        // Let's also check the movimentacoes_estoque for this material to see what was entered
        const movRes = await client.query(`
            SELECT id, pedido_compra_id, tipo, quantidade 
            FROM movimentacoes_estoque 
            WHERE material_id = $1
        `, [matId]);
        console.log("Movimentações:", movRes.rows);
     }
  } catch(e) {
     console.error(e);
  } finally {
     await client.end();
  }
}

checkCaçamba();
