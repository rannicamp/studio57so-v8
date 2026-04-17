require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function padronizarTipologia() {
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
        console.log("Iniciando varredura para padronização...");

        // 1. Unidades Habitacionais ("Tipo 1", "TIPO 1", "Tipo 2", "TIPO 2", "Tipo 3")
        const tiposHabitacionais = ["Tipo 1", "TIPO 1", "Tipo 2", "TIPO 2", "Tipo 3", "TIPO 3"];
        const { error: errHabitacional } = await supabase
            .from('produtos_empreendimento')
            .update({ tipo: 'Unidade Habitacional' })
            .in('tipo', tiposHabitacionais);
        if (errHabitacional) throw errHabitacional;
        console.log("✅ Tipos 1, 2 e 3 mapeados para 'Unidade Habitacional'.");

        // 2. Vaga Carro ("Garagem" e reajustar "VAGA CARRO" para Title Case se asim desejar, vamos padronizar tudo pra "Vaga Carro")
        const tiposVagaCarro = ["Garagem", "VAGA CARRO", "Vaga Carro", "Vaga de Carro"];
        const { error: errVagaCarro } = await supabase
            .from('produtos_empreendimento')
            .update({ tipo: 'Vaga Carro' })
            .in('tipo', tiposVagaCarro);
        if (errVagaCarro) throw errVagaCarro;
        console.log("✅ 'Garagens' e 'VAGA CARRO' mapeados para 'Vaga Carro'.");

        // 3. Vaga Moto ("VAGA MOTO" -> "Vaga Moto")
        const { error: errVagaMoto } = await supabase
            .from('produtos_empreendimento')
            .update({ tipo: 'Vaga Moto' })
            .in('tipo', ['VAGA MOTO']);
        if (errVagaMoto) throw errVagaMoto;
        console.log("✅ 'VAGA MOTO' ajustado estéticamente para 'Vaga Moto'.");

        // 4. Unidade Comercial ("Comercial")
        const { error: errComercial } = await supabase
            .from('produtos_empreendimento')
            .update({ tipo: 'Unidade Comercial' })
            .in('tipo', ['Comercial', 'COMERCIAL']);
        if (errComercial) throw errComercial;
        console.log("✅ 'Comercial' mapeado para 'Unidade Comercial'.");

        // 5. Garantir "Lote" formatado direito
        const { error: errLote } = await supabase
            .from('produtos_empreendimento')
            .update({ tipo: 'Lote' })
            .in('tipo', ['LOTE', 'lote']);
        if (errLote) throw errLote;
        console.log("✅ 'Lote' esteticamente padronizado.");

        console.log("\n🚀 PADRONIZAÇÃO CONCLUÍDA COM SUCESSO!");

    } catch (e) {
        console.error("ERRO DURANTE A EXECUÇÃO:", e.message);
    }
}

padronizarTipologia();
