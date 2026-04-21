const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCaçamba() {
  try {
     // Find the material
     const { data: matData, error: matError } = await supabase
        .from('materiais')
        .select('id, nome')
        .ilike('nome', '%Caçamba%');
        
     if (matError) throw matError;
     
     console.log("Materiais encontrados:", matData);
     
     if (matData && matData.length > 0) {
        const matId = matData[0].id;
        
        // Find orders containing this material
        const { data: pciData, error: pciError } = await supabase
            .from('pedidos_compra_itens')
            .select(`
                *
            `)
            .eq('material_id', matId);
            
        if (pciError) throw pciError;
        
        console.log("Itens de pedido de compra:", JSON.stringify(pciData, null, 2));
     }
  } catch(e) {
     console.error(e);
  }
}

checkCaçamba();
