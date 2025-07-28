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
    const context = searchParams.get('context'); // Novo: para buscar notas
    const contatoNoFunilId = searchParams.get('contatoNoFunilId'); // Novo: para buscar notas

    console.log(`API GET /api/crm: Recebida requisição. Empreendimento ID: ${empreendimentoId}, Contexto: ${context}, ContatoNoFunil ID: ${contatoNoFunilId}`);

    // Nova lógica para buscar notas
    if (context === 'notes' && contatoNoFunilId) {
        console.log(`API GET /api/crm: Buscando notas para contatoNoFunilId: ${contatoNoFunilId}`);
        try {
            const { data, error } = await supabase
                .from('crm_notas')
                .select(`
                    *,
                    usuarios(nome, sobrenome)
                `)
                .eq('contato_no_funil_id', contatoNoFunilId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("API GET /api/crm (notas): Erro ao buscar notas:", error.message);
                throw new Error(`Não foi possível buscar as notas. Erro: ${error.message}`);
            }
            console.log(`API GET /api/crm (notas): ${data.length} notas encontradas.`);
            return NextResponse.json(data);
        } catch (error) {
            console.error("API GET /api/crm (notas): Erro geral no catch:", error);
            return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    if (!empreendimentoId || empreendimentoId === 'all') {
        console.log("API GET /api/crm: ID de empreendimento não fornecido ou é 'all'.");
        return new NextResponse(JSON.stringify({ error: "ID de empreendimento é obrigatório." }), { status: 400 });
    }

    try {
        console.log(`API GET /api/crm: Buscando funil para empreendimentoId: ${empreendimentoId}`);
        let { data: funil, error: funilError } = await supabase
            .from('funis')
            .select('id, nome')
            .eq('empreendimento_id', empreendimentoId)
            .limit(1)
            .single();
        
        if (!funil && funilError?.code === 'PGRST116') {
            console.log("API GET /api/crm: Funil não encontrado. Tentando criar funil padrão.");
            funil = await createDefaultFunnel(supabase, empreendimentoId);
            if (!funil) throw new Error("Falha ao criar o funil de vendas padrão.");
            console.log("API GET /api/crm: Funil padrão criado.");
        } else if (funilError) {
            console.error("API GET /api/crm: Erro ao buscar funil de vendas:", funilError.message);
            throw new Error(`Falha ao buscar o funil de vendas: ${funilError.message}`);
        }
        console.log("API GET /api/crm: Funil encontrado/criado:", funil);

        console.log(`API GET /api/crm: Buscando colunas para funilId: ${funil.id}`);
        const { data: colunas, error: colunasError } = await supabase
            .from('colunas_funil')
            .select('id, nome, ordem')
            .eq('funil_id', funil.id)
            .order('ordem', { ascending: true });

        if (colunasError) {
            console.error("API GET /api/crm: Erro ao buscar colunas do funil:", colunasError.message);
            throw new Error(`Falha ao buscar as colunas do funil: ${colunasError.message}`);
        }
        console.log("API GET /api/crm: Colunas encontradas:", colunas);

        let contatosNoFunil = [];
        if (colunas && colunas.length > 0) {
            const colunaIds = colunas.map(c => c.id);
            console.log(`API GET /api/crm: Buscando contatos no funil para coluna IDs:`, colunaIds);
            const { data: contatosData, error: contatosError } = await supabase
                .from('contatos_no_funil')
                .select(`
                    id, 
                    coluna_id, 
                    numero_card,
                    contatos:contato_id (
                        id, 
                        nome, 
                        razao_social, 
                        created_at, 
                        telefones ( telefone, tipo ),
                        whatsapp_messages (content, sent_at, direction)
                    )
                `)
                .in('coluna_id', colunaIds);

            if (contatosError) {
                console.error("API GET /api/crm: Erro ao buscar contatos no funil:", contatosError.message);
                throw new Error(`Falha ao buscar os contatos no funil: ${contatosError.message}`);
            }
            contatosNoFunil = contatosData || [];
            console.log("API GET /api/crm: Contatos no funil carregados:", contatosNoFunil.length, "contatos.");
        } else {
            console.log("API GET /api/crm: Nenhuma coluna encontrada para o funil.");
        }

        const colunasComContatos = (colunas || []).map(coluna => ({
            ...coluna,
            contatos: contatosNoFunil.filter(c => c.coluna_id === coluna.id).map(item => item.contatos) || [],
        }));
        console.log("API GET /api/crm: Colunas com contatos formatadas.");

        return NextResponse.json({ funilId: funil.id, nome: funil.nome, colunas: colunasComContatos });

    } catch (error) {
        console.error("API GET /api/crm: Erro CATCH geral:", error); // Log do objeto de erro completo
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const payload = await request.json();
        const { funilId, nomeColuna, contatoIdParaFunil, action, contato_no_funil_id, contato_id, conteudo, usuario_id, empreendimentoId } = payload; // Adicionado empreendimentoId ao payload

        console.log("API POST /api/crm: Recebida requisição POST com payload:", payload);

        // Nova condição para criar funil padrão
        if (empreendimentoId === 'default') {
            console.log("API POST /api/crm: Tentando criar funil padrão para empreendimento 'default'.");
            const novoFunil = await createDefaultFunnel(supabase, empreendimentoId); // Reutiliza a função existente
            if (!novoFunil) {
                console.error("API POST /api/crm (createDefaultFunnel): Falha ao criar funil padrão.");
                throw new Error("Falha ao criar o funil de vendas padrão.");
            }
            console.log("API POST /api/crm (createDefaultFunnel): Funil padrão criado com sucesso:", novoFunil);
            return NextResponse.json(novoFunil);
        }
        
        if (action === 'createNote') {
            console.log("API POST /api/crm: Tentando criar nota.");
            if (!contato_no_funil_id || !contato_id || !conteudo || !usuario_id) {
                console.error("API POST /api/crm (createNote): Campos obrigatórios faltando.");
                return new NextResponse(JSON.stringify({ error: "contato_no_funil_id, contato_id, conteudo e usuario_id são obrigatórios para criar nota." }), { status: 400 });
            }

            const { data: novaNota, error: insertNoteError } = await supabase
                .from('crm_notas')
                .insert({ 
                    contato_no_funil_id, 
                    contato_id, 
                    conteudo, 
                    usuario_id 
                })
                .select()
                .single();

            if (insertNoteError) {
                console.error("API POST /api/crm (createNote): Erro ao inserir nota:", insertNoteError.message);
                throw new Error("Não foi possível criar a nota.");
            }
            console.log("API POST /api/crm (createNote): Nota criada com sucesso:", novaNota);
            return NextResponse.json(novaNota);

        } else if (contatoIdParaFunil) {
            console.log("API POST /api/crm: Tentando adicionar contato ao funil.");
            if (!funilId || !contatoIdParaFunil) {
                console.error("API POST /api/crm (addContactToFunnel): Campos obrigatórios faltando.");
                return new NextResponse(JSON.stringify({ error: "funilId e contatoIdParaFunil são obrigatórios para adicionar contato." }), { status: 400 });
            }

            const { data: primeiraColuna, error: colunaError } = await supabase
                .from('colunas_funil')
                .select('id')
                .eq('funil_id', funilId)
                .eq('ordem', 0)
                .single();

            if (colunaError || !primeiraColuna) {
                console.error("API POST /api/crm (addContactToFunnel): Erro ao buscar primeira coluna do funil:", colunaError?.message);
                throw new Error("Não foi possível encontrar a primeira coluna do funil para adicionar o contato.");
            }

            const { data: maxNumeroCardData, error: maxNumeroCardError } = await supabase
                .from('contatos_no_funil')
                .select('numero_card')
                .order('numero_card', { ascending: false })
                .limit(1)
                .single();

            const proximoNumeroCard = (maxNumeroCardData?.numero_card || 0) + 1;
            console.log(`API POST /api/crm (addContactToFunnel): Próximo numero_card: ${proximoNumeroCard}`);

            const { data: novoContatoNoFunil, error: insertError } = await supabase
                .from('contatos_no_funil')
                .insert({ 
                    contato_id: contatoIdParaFunil, 
                    coluna_id: primeiraColuna.id, 
                    numero_card: proximoNumeroCard 
                })
                .select()
                .single();

            if (insertError) {
                console.error("API POST /api/crm (addContactToFunnel): Erro ao inserir contato no funil:", insertError.message);
                throw new Error("Não foi possível adicionar o contato ao funil.");
            }
            console.log("API POST /api/crm (addContactToFunnel): Contato adicionado ao funil:", novoContatoNoFunil);
            return NextResponse.json(novoContatoNoFunil);

        } else if (nomeColuna) {
            console.log("API POST /api/crm: Tentando criar nova coluna.");
            if (!funilId || !nomeColuna) {
                console.error("API POST /api/crm (createColumn): Campos obrigatórios faltando.");
                return new NextResponse(JSON.stringify({ error: "funilId e nomeColuna são obrigatórios para criar coluna." }), { status: 400 });
            }

            const { data: maxOrdemData } = await supabase
                .from('colunas_funil')
                .select('ordem')
                .eq('funil_id', funilId)
                .order('ordem', { ascending: false })
                .limit(1)
                .single();
            
            const novaOrdem = (maxOrdemData?.ordem ?? -1) + 1;
            console.log(`API POST /api/crm (createColumn): Nova ordem para coluna: ${novaOrdem}`);

            const { data: novaColuna, error } = await supabase
                .from('colunas_funil')
                .insert({ funil_id: funilId, nome: nomeColuna, ordem: novaOrdem })
                .select()
                .single();

            if (error) {
                console.error("API POST /api/crm (createColumn): Erro ao criar nova coluna:", error.message);
                throw new Error("Não foi possível criar a nova coluna.");
            }
            console.log("API POST /api/crm (createColumn): Coluna criada:", novaColuna);
            return NextResponse.json(novaColuna);
        }
        
        console.warn("API POST /api/crm: Payload inválido ou ação não reconhecida.");
        return new NextResponse(JSON.stringify({ error: "Payload inválido para a operação POST." }), { status: 400 });

    } catch (error) {
        console.error("API POST /api/crm: Erro CATCH geral:", error); // Log do objeto de erro completo
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function PUT(request) {
    const supabase = getSupabaseAdmin();
    try {
        const payload = await request.json();
        console.log("API PUT /api/crm: Recebido payload:", payload); 

        if (payload.contatoId && payload.novaColunaId) {
            console.log(`API PUT /api/crm: Tentando mover contato ${payload.contatoId} para coluna ${payload.novaColunaId}.`);
            const { data, error } = await supabase
                .from('contatos_no_funil')
                .update({ coluna_id: payload.novaColunaId })
                .eq('id', payload.contatoId) 
                .select(); 

            if (error) {
                console.error("API PUT /api/crm (moveContact): Erro ao mover contato no Supabase:", error.message); 
                throw new Error("Não foi possível mover o contato.");
            }
            console.log("API PUT /api/crm (moveContact): Contato movido com sucesso:", data);
            return NextResponse.json({ success: true, data });

        } else if (payload.columnId && payload.newName) {
            console.log(`API PUT /api/crm: Tentando editar nome da coluna ${payload.columnId} para ${payload.newName}.`);
            const { data, error } = await supabase
                .from('colunas_funil')
                .update({ nome: payload.newName })
                .eq('id', payload.columnId)
                .select();
            
            if (error) {
                console.error("API PUT /api/crm (editColumn): Erro ao atualizar nome da coluna no Supabase:", error.message); 
                throw new Error("Não foi possível atualizar o nome da coluna.");
            }
            console.log("API PUT /api/crm (editColumn): Nome da coluna atualizado:", data);
            return NextResponse.json({ success: true, data });

        } else if (payload.reorderColumns && Array.isArray(payload.reorderColumns) && payload.funilId) {
            console.log("API PUT /api/crm: Tentando reordenar colunas.");
            const updates = payload.reorderColumns.map(col => ({
                id: col.id,
                ordem: col.ordem,
                funil_id: payload.funilId 
            }));

            const updatePromises = updates.map(async (colData) => {
                console.log(`API PUT /api/crm (reorderColumns): Atualizando coluna ${colData.id} para ordem ${colData.ordem}.`);
                const { data, error } = await supabase
                    .from('colunas_funil')
                    .update({ ordem: colData.ordem })
                    .eq('id', colData.id)
                    .eq('funil_id', colData.funil_id); 
                if (error) {
                    console.error(`API PUT /api/crm (reorderColumns): Erro ao atualizar ordem da coluna ${colData.id}:`, error.message);
                    throw error;
                }
                return data;
            });
            
            await Promise.all(updatePromises);
            console.log("API PUT /api/crm (reorderColumns): Ordem das colunas atualizada com sucesso.");
            return NextResponse.json({ success: true, message: "Ordem das colunas atualizada com sucesso." });
        }
        
        console.warn("API PUT /api/crm: Payload inválido para a operação PUT.");
        return new NextResponse(JSON.stringify({ error: "Payload inválido para a operação PUT." }), { status: 400 });

    } catch (error) {
        console.error("API PUT /api/crm: Erro CATCH geral:", error); 
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function DELETE(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { searchParams } = new URL(request.url);
        const columnId = searchParams.get('columnId');
        console.log(`API DELETE /api/crm: Recebida requisição para deletar coluna ${columnId}`);

        if (!columnId) {
            console.error("API DELETE /api/crm: ID da coluna é obrigatório para a exclusão.");
            return new NextResponse(JSON.stringify({ error: "ID da coluna é obrigatório para a exclusão." }), { status: 400 });
        }

        console.log(`API DELETE /api/crm: Deletando contatos associados à coluna ${columnId}.`);
        const { error: deleteContactsError } = await supabase
            .from('contatos_no_funil')
            .delete()
            .eq('coluna_id', columnId);

        if (deleteContactsError) {
            console.error("API DELETE /api/crm: Erro ao deletar contatos associados à coluna no Supabase:", deleteContactsError.message); 
            throw new Error("Não foi possível deletar os contatos associados à coluna.");
        }
        console.log(`API DELETE /api/crm: Contatos associados à coluna ${columnId} deletados.`);

        console.log(`API DELETE /api/crm: Deletando coluna ${columnId}.`);
        const { error } = await supabase
            .from('colunas_funil')
            .delete()
            .eq('id', columnId);

        if (error) {
            console.error("API DELETE /api/crm: Erro ao deletar coluna no Supabase:", error.message); 
            throw new Error("Não foi possível deletar a coluna.");
        }
        console.log(`API DELETE /api/crm: Coluna ${columnId} deletada com sucesso.`);

        return NextResponse.json({ success: true, message: "Coluna deletada com sucesso." });

    } catch (error) {
        console.error("API DELETE /api/crm: Erro CATCH geral:", error); 
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
