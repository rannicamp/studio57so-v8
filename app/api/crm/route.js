// app/api/crm/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Alterado para usar SUPABASE_SECRET_KEY conforme seu .env.local
    process.env.SUPABASE_SECRET_KEY 
);

// Função para criar um funil padrão com colunas
async function createDefaultFunnel(supabase, empreendimentoId) {
    try {
        const { data: empreendimento, error: empError } = await supabase
            .from('empreendimentos')
            .select('nome')
            .eq('id', empreendimentoId)
            .single();

        if (empError) throw new Error("Empreendimento não encontrado para criar funil.");

        const { data: novoFunil, error: funilError } = await supabase
            .from('funis')
            .insert({
                empreendimento_id: empreendimentoId,
                nome: `Funil - ${empreendimento.nome}`
            })
            .select()
            .single();
        
        if (funilError) throw funilError;

        const colunasPadrao = [
            { funil_id: novoFunil.id, nome: 'Lead', ordem: 0 },
            { funil_id: novoFunil.id, nome: 'Contato Feito', ordem: 1 },
            { funil_id: novoFunil.id, nome: 'Proposta Enviada', ordem: 2 },
            { funil_id: novoFunil.id, nome: 'Negociação', ordem: 3 },
        ];
        const { error: colunasError } = await supabase.from('colunas_funil').insert(colunasPadrao);
        
        if (colunasError) throw colunasError;

        return novoFunil;
    } catch (error) {
        console.error("Erro ao criar funil padrão:", error);
        return null;
    }
}

export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const empreendimentoId = searchParams.get('empreendimentoId');

    if (!empreendimentoId || empreendimentoId === 'all') {
        return new NextResponse(JSON.stringify({ error: "ID de empreendimento é obrigatório." }), { status: 400 });
    }

    try {
        let { data: funil, error: funilError } = await supabase
            .from('funis')
            .select('id, nome')
            .eq('empreendimento_id', empreendimentoId)
            .limit(1)
            .single();
        
        if (!funil && funilError?.code === 'PGRST116') {
             funil = await createDefaultFunnel(supabase, empreendimentoId);
             if (!funil) throw new Error("Falha ao criar o funil de vendas padrão.");
        } else if (funilError) {
            throw new Error(`Falha ao buscar o funil de vendas: ${funilError.message}`);
        }

        const { data: colunas, error: colunasError } = await supabase
            .from('colunas_funil')
            .select('id, nome, ordem')
            .eq('funil_id', funil.id)
            .order('ordem', { ascending: true });

        if (colunasError) throw new Error(`Falha ao buscar as colunas do funil: ${colunasError.message}`);

        let contatosNoFunil = [];
        // CORREÇÃO: Só busca contatos se existirem colunas
        if (colunas && colunas.length > 0) {
            const { data: contatosData, error: contatosError } = await supabase
                .from('contatos_no_funil')
                .select(`coluna_id, contatos:contato_id (id, nome, razao_social, telefones ( telefone, tipo ))`)
                .in('coluna_id', colunas.map(c => c.id));

            if (contatosError) throw new Error(`Falha ao buscar os contatos no funil: ${contatosError.message}`);
            contatosNoFunil = contatosData || [];
        }

        const colunasComContatos = (colunas || []).map(coluna => ({
            ...coluna,
            contatos: contatosNoFunil.filter(c => c.coluna_id === coluna.id).map(item => item.contatos) || [],
        }));

        return NextResponse.json({ funilId: funil.id, nome: funil.nome, colunas: colunasComContatos });

    } catch (error) {
        console.error("Erro na API GET /api/crm:", error.message);
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { funilId, nomeColuna } = await request.json();

        if (!funilId || !nomeColuna) {
            return new NextResponse(JSON.stringify({ error: "funilId e nomeColuna são obrigatórios" }), { status: 400 });
        }

        const { data: maxOrdemData } = await supabase
            .from('colunas_funil')
            .select('ordem')
            .eq('funil_id', funilId)
            .order('ordem', { ascending: false })
            .limit(1)
            .single();
        
        const novaOrdem = (maxOrdemData?.ordem ?? -1) + 1;

        const { data: novaColuna, error } = await supabase
            .from('colunas_funil')
            .insert({ funil_id: funilId, nome: nomeColuna, ordem: novaOrdem })
            .select()
            .single();

        if (error) throw new Error("Não foi possível criar a nova coluna.");

        return NextResponse.json(novaColuna);

    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function PUT(request) {
    const supabase = getSupabaseAdmin();
    try {
        const payload = await request.json();
        console.log("Recebido payload na API PUT /api/crm:", payload); // Log do payload

        if (payload.contatoId && payload.novaColunaId) {
            // Lógica para mover contato
            const { data, error } = await supabase
                .from('contatos_no_funil')
                .upsert({ contato_id: payload.contatoId, coluna_id: payload.novaColunaId }, { onConflict: 'contato_id' })
                .select();

            if (error) {
                console.error("Erro ao mover contato no Supabase:", error.message); // Log de erro específico
                throw new Error("Não foi possível mover o contato.");
            }
            return NextResponse.json({ success: true, data });

        } else if (payload.columnId && payload.newName) {
            // Lógica para editar nome da coluna
            const { data, error } = await supabase
                .from('colunas_funil')
                .update({ nome: payload.newName })
                .eq('id', payload.columnId)
                .select();
            
            if (error) {
                console.error("Erro ao atualizar nome da coluna no Supabase:", error.message); // Log de erro específico
                throw new Error("Não foi possível atualizar o nome da coluna.");
            }
            return NextResponse.json({ success: true, data });
        } else if (payload.reorderColumns && Array.isArray(payload.reorderColumns) && payload.funilId) {
            // Lógica para reordenar colunas
            const updates = payload.reorderColumns.map(col => ({
                id: col.id,
                ordem: col.ordem,
                nome: col.nome, // Incluído o nome para garantir o upsert
                funil_id: payload.funilId // Garante que a atualização é para o funil correto
            }));

            // Agora, vamos fazer as atualizações uma a uma para garantir a ordem
            // e ter mais controle sobre o processo.
            const updatePromises = updates.map(async (colData) => {
                const { error } = await supabase
                    .from('colunas_funil')
                    .update({ ordem: colData.ordem }) // Apenas atualiza a ordem
                    .eq('id', colData.id)
                    .eq('funil_id', colData.funil_id); // Garante que atualiza a coluna do funil correto
                
                if (error) {
                    console.error(`Erro ao atualizar ordem da coluna ${colData.id}:`, error.message);
                    throw new Error(`Falha ao atualizar a ordem da coluna ${colData.nome}.`);
                }
                return true;
            });

            await Promise.all(updatePromises); // Aguarda todas as atualizações

            return NextResponse.json({ success: true, message: "Ordem das colunas atualizada com sucesso." });
        }
        
        return new NextResponse(JSON.stringify({ error: "Payload inválido para a operação PUT." }), { status: 400 });

    } catch (error) {
        console.error("Erro geral na API PUT /api/crm:", error.message); // Log de erro geral
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function DELETE(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { searchParams } = new URL(request.url);
        const columnId = searchParams.get('columnId');

        if (!columnId) {
            return new NextResponse(JSON.stringify({ error: "ID da coluna é obrigatório para a exclusão." }), { status: 400 });
        }

        const { error: deleteContactsError } = await supabase
            .from('contatos_no_funil')
            .delete()
            .eq('coluna_id', columnId);

        if (deleteContactsError) {
            console.error("Erro ao deletar contatos associados à coluna no Supabase:", deleteContactsError.message); // Log de erro específico
            throw new Error("Não foi possível deletar os contatos associados à coluna.");
        }

        const { error } = await supabase
            .from('colunas_funil')
            .delete()
            .eq('id', columnId);

        if (error) {
            console.error("Erro ao deletar coluna no Supabase:", error.message); // Log de erro específico
            throw new Error("Não foi possível deletar a coluna.");
        }

        return NextResponse.json({ success: true, message: "Coluna deletada com sucesso." });

    } catch (error) {
        console.error("Erro geral na API DELETE /api/crm:", error.message); // Log de erro geral
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
