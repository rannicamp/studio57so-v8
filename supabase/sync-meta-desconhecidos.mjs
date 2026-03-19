import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Iniciando varredura de ativos 'Desconhecido'...");
    
    const { data: ativos, error } = await supabase
        .from('meta_ativos')
        .select('*')
        .eq('nome', 'Desconhecido');
        
    if (error) { console.error(error); return; }
    if (!ativos || ativos.length === 0) {
        console.log("Nenhum ativo 'Desconhecido' encontrado!");
        return;
    }
    
    console.log(`Encontrados ${ativos.length} ativos para buscar nome direto pelo Facebook Marketing API...`);

    const tokensCache = {}; 
    let alterados = 0;

    for (const ativo of ativos) {
        if (!tokensCache[ativo.organizacao_id]) {
            const { data: ints } = await supabase
                .from('integracoes_meta')
                .select('access_token')
                .eq('organizacao_id', ativo.organizacao_id)
                .limit(1);
            if (ints && ints.length > 0) {
                tokensCache[ativo.organizacao_id] = ints[0].access_token;
            } else {
                tokensCache[ativo.organizacao_id] = 'NO_TOKEN';
            }
        }

        const token = tokensCache[ativo.organizacao_id];
        if (token === 'NO_TOKEN') {
            console.log(`[Pulo] Org ${ativo.organizacao_id} sem token Meta associado.`);
            continue;
        }

        try {
            const res = await fetch(`https://graph.facebook.com/v20.0/${ativo.id}?fields=name&access_token=${token}`);
            const data = await res.json();
            
            if (data.name) {
                console.log(`[Sucesso] ${ativo.tipo} ${ativo.id} -> ${data.name}`);
                await supabase.from('meta_ativos').update({ nome: data.name }).eq('id', ativo.id);
                alterados++;
            } else if (data.error) {
                console.log(`[Erro Meta API] ID: ${ativo.id} | Motivo: ${data.error.message}`);
                // Às vezes o ID do Meta foi deletado lá. Nada que possamos fazer a não ser manter 'Desconhecido'.
            }
        } catch (err) {
            console.error(`[Exceção Local] ${ativo.id}: ${err.message}`);
        }
    }

    console.log(`\nVarredura concluída! ${alterados} ativos atualizados com o nome real.`);
}

run();
