require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runRepair() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("ERRO: Credenciais do Supabase não encontradas.");
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        // Encontrar as garagens totais para fazer a analise manualmente no app
        const { data: todasGaragens, error: errGetAll } = await supabase
            .from('produtos_empreendimento')
            .select('id, unidade, tipo, area_m2, empreendimento_id');
            
        if (errGetAll) throw errGetAll;
        
        const garagens = todasGaragens.filter(p => 
            (p.unidade && p.unidade.toLowerCase().includes('garagem')) || 
            (p.unidade && p.unidade.toLowerCase().includes('vaga')) ||
            (p.tipo && p.tipo.toLowerCase().includes('garagem')) ||
            (p.tipo && p.tipo.toLowerCase().includes('vaga'))
        );
        
        // Contar areas validas > 0
        const counts = {};
        for(const p of garagens) {
            if (p.area_m2 && p.area_m2 > 0) {
                counts[p.area_m2] = (counts[p.area_m2] || 0) + 1;
            }
        }
        
        let mostCommonArea = 0;
        let highestCount = 0;
        for(const area in counts) {
            if(counts[area] > highestCount) {
                highestCount = counts[area];
                mostCommonArea = Number(area);
            }
        }
        
        // Localizar irregulares (zeradas)
        const zeradas = garagens.filter(p => !p.area_m2 || p.area_m2 === 0);
        const idsToUpdate = zeradas.map(g => g.id);
        
        if (mostCommonArea === 0 && garagens.length > 0) {
            // Se nao tem area comum mas tem garagens zeradas, vamos defaultar pra 12m2 (padrao BR)
            mostCommonArea = 12.0;
        }
        
        // 3. Atualizar
        if(idsToUpdate.length > 0) {
            const { error: errUpdate } = await supabase
                .from('produtos_empreendimento')
                .update({ area_m2: mostCommonArea })
                .in('id', idsToUpdate);
                
            if(errUpdate) throw errUpdate;
        }
        
        console.log(JSON.stringify({
            padraoInjetado: mostCommonArea,
            totalAtualizado: idsToUpdate.length,
            garagensAfetadas: zeradas
        }));

    } catch (e) {
        console.error(JSON.stringify({ error: e.message }));
    }
}

runRepair();
