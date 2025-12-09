import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function DELETE(request) {
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: "Config error" }, { status: 500 });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request) {
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: "Config error" }, { status: 500 });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        const { id, template_name, language, variables, full_text_base, components, scheduled_at } = body;

        // Atualiza apenas se ainda estiver pendente
        const { error } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({
                template_name,
                language,
                variables,
                full_text_base,
                components,
                scheduled_at
            })
            .eq('id', id)
            .eq('status', 'pending'); // Segurança: não edita se já foi enviado

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}