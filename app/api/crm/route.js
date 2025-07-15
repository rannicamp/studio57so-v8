// app/api/crm/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função auxiliar para criar um cliente Supabase com permissões de administrador
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * ROTA GET: Busca os funis de um empreendimento e suas respectivas colunas com os contatos.
 * Parâmetros da URL:
 * - empreendimentoId (opcional): O ID do empreendimento para filtrar o funil. Se não for fornecido, busca um funil geral.
 */
export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const empreendimentoId = searchParams.get('empreendimentoId');

    try {
        // 1. Encontrar o funil correto
        let funilQuery = supabase.from('funis').select('id').limit(1).single();
        if (empreendimentoId) {
            funilQuery = funilQuery.eq('empreendimento_id', empreendimentoId);
        } else {
            funilQuery = funilQuery.is('empreendimento_id', null);
        }

        const { data: funil, error: funilError } = await funilQuery;

        if (funilError && funilError.code !== 'PGRST116') { // Ignora erro "nenhum resultado encontrado" por enquanto
            console.error("Erro ao buscar funil:", funilError);
            throw new Error("Falha ao buscar o funil de vendas.");
        }
        
        // Se não existir um funil para o empreendimento, podemos retornar um estado vazio ou criar um
        if (!funil) {
            // Por agora, apenas retornamos vazio. No futuro, podemos criar um funil padrão aqui.
            return NextResponse.json({ funilId: null, colunas: [] });
        }

        // 2. Buscar as colunas do funil, ordenadas corretamente
        const { data: colunas, error: colunasError } = await supabase
            .from('colunas_funil')
            .select('id, nome, ordem')
            .eq('funil_id', funil.id)
            .order('ordem', { ascending: true });

        if (colunasError) {
            console.error("Erro ao buscar colunas:", colunasError);
            throw new Error("Falha ao buscar as colunas do funil.");
        }

        // 3. Buscar todos os contatos que estão neste funil
        const { data: contatosNoFunil, error: contatosError } = await supabase
            .from('contatos_no_funil')
            .select(`
                coluna_id,
                contatos:contato_id (
                    id,
                    nome,
                    razao_social,
                    foto_url,
                    telefones ( telefone, tipo )
                )
            `)
            .in('coluna_id', colunas.map(c => c.id));

        if (contatosError) {
            console.error("Erro ao buscar contatos no funil:", contatosError);
            throw new Error("Falha ao buscar os contatos no funil.");
        }

        // 4. Organizar os contatos dentro de suas respectivas colunas
        const colunasComContatos = colunas.map(coluna => {
            const contatosDaColuna = contatosNoFunil
                .filter(contato => contato.coluna_id === coluna.id)
                .map(item => item.contatos); // Extrai o objeto do contato
            return {
                ...coluna,
                contatos: contatosDaColuna,
            };
        });

        return NextResponse.json({ funilId: funil.id, colunas: colunasComContatos });

    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

/**
 * ROTA POST: Cria uma nova coluna em um funil existente.
 * Corpo da requisição (JSON):
 * - funilId: O ID do funil onde a coluna será criada.
 * - nomeColuna: O nome da nova coluna.
 */
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { funilId, nomeColuna } = await request.json();

        if (!funilId || !nomeColuna) {
            return new NextResponse(JSON.stringify({ error: "funilId e nomeColuna são obrigatórios" }), { status: 400 });
        }

        // Busca a maior ordem existente para adicionar a nova coluna ao final
        const { data: maxOrdemData, error: ordemError } = await supabase
            .from('colunas_funil')
            .select('ordem')
            .eq('funil_id', funilId)
            .order('ordem', { ascending: false })
            .limit(1)
            .single();
        
        const novaOrdem = (maxOrdemData?.ordem || 0) + 1;

        const { data: novaColuna, error } = await supabase
            .from('colunas_funil')
            .insert({
                funil_id: funilId,
                nome: nomeColuna,
                ordem: novaOrdem,
            })
            .select()
            .single();

        if (error) {
            console.error("Erro ao criar nova coluna:", error);
            throw new Error("Não foi possível criar a nova coluna.");
        }

        return NextResponse.json(novaColuna);

    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}


/**
 * ROTA PUT: Move um contato para uma nova coluna.
 * Corpo da requisição (JSON):
 * - contatoId: O ID do contato a ser movido.
 * - novaColunaId: O ID da coluna de destino.
 */
export async function PUT(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { contatoId, novaColunaId } = await request.json();

        if (!contatoId || !novaColunaId) {
            return new NextResponse(JSON.stringify({ error: "contatoId e novaColunaId são obrigatórios" }), { status: 400 });
        }

        // A cláusula 'upsert' é perfeita aqui:
        // - Se o contato já estiver no funil, ele atualiza a coluna (UPDATE).
        // - Se for a primeira vez do contato no funil, ele insere o registro (INSERT).
        const { data, error } = await supabase
            .from('contatos_no_funil')
            .upsert({
                contato_id: contatoId,
                coluna_id: novaColunaId,
            }, {
                onConflict: 'contato_id' // A coluna que define o conflito
            })
            .select();

        if (error) {
            console.error("Erro ao mover contato:", error);
            throw new Error("Não foi possível mover o contato.");
        }

        return NextResponse.json({ success: true, data });

    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}