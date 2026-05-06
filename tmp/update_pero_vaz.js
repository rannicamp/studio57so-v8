require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateProduct() {
    const novaDescricao = 'Apartamento Térreo com 2 Quartos (10,40m² e 8,90m²), Banheiro Social (2,70m²), Sala de Estar/Jantar (13,86m²), Cozinha/Área de Serviço (6,30m²) e Sacada (3,03m²). Pronto para morar, ideal para o programa Minha Casa Minha Vida. 1 vaga de garagem descoberta (10,35m²) já inclusa.';

    const { data, error } = await supabase
        .from('produtos_empreendimento')
        .update({
            descricao: novaDescricao
        })
        .eq('id', 221)
        .select();

    if (error) {
        console.error("Erro ao atualizar:", error);
    } else {
        console.log("Produto atualizado com sucesso:", data);
    }
}

updateProduct();
