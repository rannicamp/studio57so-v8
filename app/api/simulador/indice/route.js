// app/api/simulador/indice/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos a chave Service Role Bypassar RLS porque esta chamada parte de uma landing page anônima.
// A rota funciona como proxy de leitura: pega um índice específico (ex: IPCA) e retorna o seu valor de 12 meses acumulado
export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const indiceNome = searchParams.get('indice') || 'INCC';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Configuração do servidor incorreta.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Chamada da função RPC calcular_acumulado_12m
        // Data limite será HOJE
        const dataHoje = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase.rpc('calcular_acumulado_12m', {
            p_indice: indiceNome,
            p_data_limite: dataHoje
        });

        if (error) {
            console.error("Erro no RPC interno:", error);
            return NextResponse.json({ error: 'Falha ao processar índice no banco.', details: error.message }, { status: 500 });
        }

        return NextResponse.json({
            indice: indiceNome,
            taxa_acumulada_12m: data // Retorna algo como 4.542
        });

    } catch (err) {
        return NextResponse.json({ error: 'Erro interno.', details: err.message }, { status: 500 });
    }
}
