// app/api/crm/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para obter o cliente Supabase com permissões de administrador
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY 
);

// --- FUNÇÕES DE LÓGICA (HANDLERS) ---

// Lida com a criação de novos itens (colunas, notas, contatos no funil)
async function handlePost(supabase, payload) {
    const { funilId, nomeColuna, contatoIdParaFunil, action, contato_no_funil_id, contato_id, conteudo, usuario_id } = payload;

    if (action === 'createNote') {
        if (!contato_no_funil_id || !contato_id || !conteudo || !usuario_id) {
            throw new Error("Campos obrigatórios faltando para criar nota.");
        }
        const { data, error } = await supabase.from('crm_notas').insert({ contato_no_funil_id, contato_id, conteudo, usuario_id }).select().single();
        if (error) throw new Error("Não foi possível criar a nota: " + error.message);
        return data;
    }

    if (contatoIdParaFunil) {
        if (!funilId) throw new Error("funilId é obrigatório para adicionar contato.");
        const { data: primeiraColuna, error: colunaError } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).order('ordem').limit(1).single();
        if (colunaError || !primeiraColuna) throw new Error("Coluna inicial do funil não encontrada.");

        const { data: maxNumeroCardData } = await supabase.from('contatos_no_funil').select('numero_card').order('numero_card', { ascending: false }).limit(1).single();
        const proximoNumeroCard = (maxNumeroCardData?.numero_card || 0) + 1;

        const { data, error } = await supabase.from('contatos_no_funil').insert({ contato_id: contatoIdParaFunil, coluna_id: primeiraColuna.id, numero_card: proximoNumeroCard }).select().single();
        if (error) throw new Error("Não foi possível adicionar o contato ao funil: " + error.message);
        return data;
    }

    if (nomeColuna) {
        if (!funilId) throw new Error("funilId é obrigatório para criar coluna.");
        const { data: maxOrdemData } = await supabase.from('colunas_funil').select('ordem').eq('funil_id', funilId).order('ordem', { ascending: false }).limit(1).single();
        const novaOrdem = (maxOrdemData?.ordem ?? -1) + 1;
        const { data, error } = await supabase.from('colunas_funil').insert({ funil_id: funilId, nome: nomeColuna, ordem: novaOrdem }).select().single();
        if (error) throw new Error("Não foi possível criar a nova coluna: " + error.message);
        return data;
    }

    throw new Error("Payload inválido ou ação não reconhecida para a operação POST.");
}

// Lida com a atualização de itens (mover cartão, renomear coluna, reordenar)
async function handlePut(supabase, payload) {
    // Mover um contato para uma nova coluna
    if (payload.contatoId && payload.novaColunaId) {
        const { data, error } = await supabase
            .from('contatos_no_funil')
            .update({ coluna_id: payload.novaColunaId, updated_at: new Date().toISOString() })
            .eq('id', payload.contatoId)
            .select()
            .single();
        if (error) throw new Error("Não foi possível mover o contato: " + error.message);
        return { success: true, data: data, message: "Contato movido com sucesso!" };
    }

    // Renomear uma coluna
    if (payload.columnId && payload.newName) {
        const { data, error } = await supabase.from('colunas_funil').update({ nome: payload.newName }).eq('id', payload.columnId).select();
        if (error) throw new Error("Não foi possível atualizar o nome da coluna: " + error.message);
        return { success: true, data };
    }

    // Reordenar colunas
    if (payload.reorderColumns && Array.isArray(payload.reorderColumns)) {
        const updatePromises = payload.reorderColumns.map(col =>
            supabase.from('colunas_funil').update({ ordem: col.ordem }).eq('id', col.id)
        );
        const results = await Promise.all(updatePromises);
        const firstError = results.find(res => res.error);
        if (firstError) throw new Error("Erro ao reordenar uma ou mais colunas: " + firstError.error.message);
        return { success: true, message: "Ordem das colunas atualizada." };
    }

    throw new Error("Payload inválido para a operação PUT.");
}

// Lida com a exclusão de itens (colunas)
async function handleDelete(supabase, searchParams) {
    const columnId = searchParams.get('columnId');
    if (!columnId) throw new Error("ID da coluna é obrigatório para a exclusão.");
    
    // Deleta os contatos na coluna
    await supabase.from('contatos_no_funil').delete().eq('coluna_id', columnId);
    
    // Deleta a coluna
    const { error } = await supabase.from('colunas_funil').delete().eq('id', columnId);
    if (error) throw new Error("Não foi possível deletar a coluna: " + error.message);
    
    return { success: true, message: "Coluna deletada com sucesso." };
}


// --- ROTAS DA API ---

export async function GET(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { searchParams } = new URL(request.url);
        const context = searchParams.get('context');
        const contatoNoFunilId = searchParams.get('contatoNoFunilId');
        
        if (context === 'notes' && contatoNoFunilId) {
            const { data, error } = await supabase.from('crm_notas').select(`*, usuarios(nome, sobrenome)`).eq('contato_no_funil_id', contatoNoFunilId).order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return NextResponse.json(data);
        }
        return new NextResponse(JSON.stringify({ error: "Contexto inválido para GET." }), { status: 400 });
    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const payload = await request.json();
        const result = await handlePost(supabase, payload);
        return NextResponse.json(result);
    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function PUT(request) {
    const supabase = getSupabaseAdmin();
    try {
        const payload = await request.json();
        const result = await handlePut(supabase, payload);
        return NextResponse.json(result);
    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function DELETE(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { searchParams } = new URL(request.url);
        const result = await handleDelete(supabase, searchParams);
        return NextResponse.json(result);
    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}