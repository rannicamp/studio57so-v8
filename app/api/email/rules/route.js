import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // Busca as regras e faz o JOIN com email_configuracoes para pegar o nome da conta
    // O left join garante que regras antigas (sem account_id) também venham
    const { data, error } = await supabase
        .from('email_regras')
        .select(`
            *,
            email_configuracoes (
                id,
                conta_apelido,
                email
            )
        `)
        .eq('user_id', user.id)
        .order('ordem', { ascending: true });

    if (error) {
        console.error('Erro ao buscar regras:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request) {
    const supabase = await createClient();
    
    try {
        const body = await request.json();
        const { id, nome, condicoes, acoes, account_id, ordem } = body;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // Tenta pegar a organização do usuário para manter a integridade
        // (Baseado no seu schema, organizacao_id é bigint)
        const { data: userData } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        const organizacaoId = userData?.organizacao_id || null;

        // TRATAMENTO DE DADOS
        // Se account_id vier vazio string, converte para NULL para não quebrar o banco (UUID inválido)
        const finalAccountId = account_id && account_id.trim() !== '' ? account_id : null;

        const payload = {
            user_id: user.id,
            organizacao_id: organizacaoId, // Preenche o campo obrigatório do schema
            nome,
            condicoes,
            acoes,
            account_id: finalAccountId,
            ativo: true
        };

        // Se for criar (não tem ID), define a ordem
        if (!id) {
            payload.ordem = ordem || 999;
        }

        let result;
        if (id) {
            // Atualizar
            result = await supabase.from('email_regras').update(payload).eq('id', id).select();
        } else {
            // Criar
            result = await supabase.from('email_regras').insert(payload).select();
        }

        if (result.error) {
            throw new Error(result.error.message);
        }

        return NextResponse.json({ success: true, data: result.data });

    } catch (error) {
        console.error('Erro ao salvar regra:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 });

    const { error } = await supabase.from('email_regras').delete().eq('id', id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}