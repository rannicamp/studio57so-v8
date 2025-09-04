// app/api/crm/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// Função para buscar notas de um contato no funil
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context');
    const contatoNoFunilId = searchParams.get('contatoNoFunilId');
    const supabase = createClient(cookies());

    if (context === 'notes' && contatoNoFunilId) {
        try {
            const { data, error } = await supabase
                .from('crm_notas')
                .select('*, usuarios(nome, sobrenome)')
                .eq('contato_no_funil_id', contatoNoFunilId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json(data);
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
}


// Função para ATUALIZAR dados (mover card, renomear coluna, etc.)
export async function PUT(req) {
    const body = await req.json();
    const supabase = createClient(cookies());

    // --- LÓGICA CORRIGIDA PARA MOVER O CONTATO ---
    if (body.contatoId && body.novaColunaId) {
        try {
            const { error } = await supabase
                .from('contatos_no_funil')
                .update({ coluna_id: body.novaColunaId, updated_at: new Date().toISOString() })
                .eq('id', body.contatoId);

            if (error) {
                // Se o banco de dados retornar um erro, ele será enviado na resposta
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ message: "Contato movido com sucesso." });
        } catch (error) {
            return NextResponse.json({ error: 'Erro interno do servidor ao tentar mover o contato.' }, { status: 500 });
        }
    }

    // Lógica para renomear uma coluna
    if (body.columnId && body.newName) {
        try {
            const { error } = await supabase.from('colunas_funil').update({ nome: body.newName }).eq('id', body.columnId);
            if (error) throw error;
            return NextResponse.json({ message: 'Coluna atualizada com sucesso.' });
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    // Lógica para reordenar colunas
    if (body.reorderColumns && body.funilId) {
        try {
            const updates = body.reorderColumns.map(col =>
                supabase.from('colunas_funil').update({ ordem: col.ordem }).eq('id', col.id)
            );
            const results = await Promise.all(updates);
            const firstError = results.find(res => res.error);
            if (firstError) throw firstError.error;
            return NextResponse.json({ message: 'Ordem das colunas atualizada.' });
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    return NextResponse.json({ error: 'Parâmetros inválidos para a requisição PUT.' }, { status: 400 });
}


// Função para CRIAR dados (nota, coluna)
export async function POST(req) {
    const body = await req.json();
    const supabase = createClient(cookies());

    // Lógica para criar uma nota
    if (body.action === 'createNote') {
        const { contato_no_funil_id, contato_id, conteudo, usuario_id } = body;
        try {
            const { data, error } = await supabase.from('crm_notas').insert({ contato_no_funil_id, contato_id, conteudo, usuario_id }).select().single();
            if (error) throw error;
            return NextResponse.json(data);
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    // Lógica para criar uma coluna
    if (body.funilId && body.nomeColuna) {
        try {
            const { data: maxOrder } = await supabase.from('colunas_funil').select('ordem').eq('funil_id', body.funilId).order('ordem', { ascending: false }).limit(1).single();
            const newOrder = (maxOrder?.ordem || 0) + 1;
            const { data, error } = await supabase.from('colunas_funil').insert({ funil_id: body.funilId, nome: body.nomeColuna, ordem: newOrder }).select().single();
            if (error) throw error;
            return NextResponse.json(data);
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    return NextResponse.json({ error: 'Ação ou parâmetros inválidos.' }, { status: 400 });
}


// Função para DELETAR uma coluna
export async function DELETE(req) {
    const { searchParams } = new URL(req.url);
    const columnId = searchParams.get('columnId');
    const supabase = createClient(cookies());

    if (!columnId) return NextResponse.json({ error: 'ID da coluna é obrigatório.' }, { status: 400 });

    try {
        const { data: firstColumn } = await supabase.from('colunas_funil').select('id, funil_id').order('ordem').limit(1).single();
        if (!firstColumn) throw new Error("Nenhuma coluna de destino encontrada.");
        if (firstColumn.id === columnId) throw new Error("Não é possível deletar a primeira coluna.");

        await supabase.rpc('move_contacts_to_first_column_and_delete', {
            column_to_delete_id: columnId,
            target_column_id: firstColumn.id
        });

        return NextResponse.json({ message: 'Coluna deletada e contatos movidos.' });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}