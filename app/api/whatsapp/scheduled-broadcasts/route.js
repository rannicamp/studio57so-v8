import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const organizacaoId = searchParams.get('organizacaoId');
    const listaId = searchParams.get('listaId');

    let query = supabase
        .from('whatsapp_scheduled_broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

    if (organizacaoId) query = query.eq('organizacao_id', organizacaoId);
    if (listaId) query = query.eq('lista_id', listaId);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(request) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        const body = await request.json();
        const { error } = await supabase.from('whatsapp_scheduled_broadcasts').insert(body);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// --- NOVO: ROTA PARA CONTROLAR (PAUSAR/RETOMAR/PARAR) ---
export async function PATCH(request) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        const body = await request.json();
        const { id, action, organizacao_id } = body;

        if (!id || !action) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

        let newStatus = '';
        if (action === 'pause') newStatus = 'paused';
        if (action === 'resume') newStatus = 'pending'; // Volta para a fila
        if (action === 'stop') newStatus = 'stopped';

        // Atualiza o status
        const { error } = await supabase
            .from('whatsapp_scheduled_broadcasts')
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('organizacao_id', organizacao_id); // Segurança extra

        if (error) throw error;

        return NextResponse.json({ success: true, status: newStatus });

    } catch (error) {
        console.error("Erro ao atualizar broadcast:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}