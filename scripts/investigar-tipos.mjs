import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if(!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Consultando elementos_bim...");
    
    // Obter 2000 elementos onde o tipo seja nulo, vazio, "Elemento MEP" ou "Sem Tipo" ou "(sem tipo)"
    const { data, error } = await supabase
        .from('elementos_bim')
        .select('categoria, familia, tipo, propriedades')
        .limit(2000)
        .order('id', { ascending: false });

    if (error) {
        console.error("Erro na consulta:", error);
        return;
    }

    console.log(`Analisados ${data.length} elementos recentes.`);

    const propKeys = {};
    const propValues = {};
    const missingTypes = [];

    for (const item of data) {
        const t = item.tipo?.toLowerCase() || '';
        const isMissing = t === '' || t === 'sem tipo' || t === '(sem tipo)' || t === 'elemento mep';
        
        if (isMissing && item.propriedades) {
            missingTypes.push(item);
            for (const [key, val] of Object.entries(item.propriedades)) {
                
                // Procurando chaves que pareçam conter a descrição do tipo
                // Ex: "Nome do tipo", "Type Name", "Type", "Tipo"
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('tipo') || lowerKey.includes('type')) {
                    propKeys[key] = (propKeys[key] || 0) + 1;
                    if(!propValues[key]) propValues[key] = new Set();
                    propValues[key].add(val);
                }
            }
        }
    }

    console.log(`Deles, ${missingTypes.length} estão com tipo missing.`);
    console.log("Frequência das propriedades relacionadas a 'tipo':");
    for (const [key, count] of Object.entries(propKeys).sort((a,b) => b[1] - a[1])) {
        console.log(`- "${key}": apareceu ${count} vezes.`);
        console.log(`  Exemplos: ${Array.from(propValues[key]).slice(0, 5).join(', ')}`);
    }
}

run();
