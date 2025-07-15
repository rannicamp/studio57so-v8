// app/api/crm/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
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
        const { contatoId, novaColunaId } = await request.json();
        if (!contatoId || !novaColunaId) {
            return new NextResponse(JSON.stringify({ error: "contatoId e novaColunaId são obrigatórios" }), { status: 400 });
        }

        const { data, error } = await supabase
            .from('contatos_no_funil')
            .upsert({ contato_id: contatoId, coluna_id: novaColunaId }, { onConflict: 'contato_id' })
            .select();

        if (error) throw new Error("Não foi possível mover o contato.");

        return NextResponse.json({ success: true, data });

    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}