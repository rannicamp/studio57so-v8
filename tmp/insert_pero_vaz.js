require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertProduct() {
    const produto = {
        empreendimento_id: 10,
        tipo: 'Unidade Habitacional',
        unidade: '101 (Bloco 02)',
        area_m2: 87.14,
        valor_base: 180000.00,
        fator_reajuste_percentual: 0,
        valor_venda_calculado: 180000.00,
        status: 'Disponível',
        organizacao_id: 2,
        matricula: '54.630',
        preco_m2: 2065.64,
        descricao: 'Apartamento Térreo com 2 Quartos (10,40m² e 8,90m²), Banheiro Social (2,70m²), Sala de Estar/Jantar (13,86m²), Cozinha/Área de Serviço (6,30m²), Sacada (3,03m²) e Quintal privativo (10,35m²). Direito a 1 vaga de garagem.'
    };

    const { data, error } = await supabase
        .from('produtos_empreendimento')
        .insert([produto])
        .select();

    if (error) {
        console.error("Erro ao inserir:", error);
    } else {
        console.log("Produto inserido com sucesso:", data);
    }
}

insertProduct();
