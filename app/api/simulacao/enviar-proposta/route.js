// app/api/simulacao/enviar-proposta/route.js

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// Função para buscar ou criar um contato
async function getOrCreateContato(supabase, contatoInfo, tipo) {
    const { nome, telefone, country_code } = contatoInfo;

    if (tipo === 'corretor' && !nome) {
        return null;
    }
    if (tipo === 'cliente' && (!nome || !telefone)) {
        throw new Error(`Dados incompletos para o ${tipo}: Nome e Telefone são obrigatórios.`);
    }
    
    if (telefone) {
        let { data: existingTelefone } = await supabase
            .from('telefones')
            .select('contato_id')
            .eq('telefone', telefone)
            .maybeSingle();

        if (existingTelefone) {
            return existingTelefone.contato_id;
        }
    }
    
    const insertData = {
        nome: nome,
        tipo_contato: 'Lead', // Todos são Leads por padrão
        origem: 'Simulador Financeiro',
    };

    if (tipo === 'corretor') {
        insertData.cargo = 'Corretor'; // Adiciona o cargo para diferenciar
    }

    const { data: novoContato, error: erroContato } = await supabase
        .from('contatos')
        .insert(insertData)
        .select('id')
        .single();

    if (erroContato) {
        console.error(`Erro ao criar novo contato (${tipo}):`, erroContato);
        throw new Error(`Não foi possível criar o contato do ${tipo}.`);
    }

    if (telefone) {
        const { error: erroTelefone } = await supabase
            .from('telefones')
            .insert({
                contato_id: novoContato.id,
                telefone: telefone,
                country_code: country_code,
                tipo: 'celular',
            });
        
        if (erroTelefone) {
            console.error(`Erro ao associar telefone ao novo contato (${tipo}):`, erroTelefone);
        }
    }

    return novoContato.id;
}


export async function POST(request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { simulacaoData } = body;
        
        const { empreendimento, produtos, plano, cliente, corretor, valorFinal } = simulacaoData;

        if (!cliente || !cliente.nome || !cliente.telefone) {
             return NextResponse.json({ error: 'O nome e o telefone do cliente são obrigatórios.' }, { status: 400 });
        }
        if (!empreendimento || !produtos || produtos.length === 0) {
             return NextResponse.json({ error: 'Empreendimento e ao menos uma unidade devem ser selecionados.' }, { status: 400 });
        }

        const clienteId = await getOrCreateContato(supabase, cliente, 'cliente');
        const corretorId = await getOrCreateContato(supabase, corretor, 'corretor');

        const { data: simulacaoSalva, error: erroSimulacao } = await supabase
            .from('simulacoes')
            .insert({
                contato_id: clienteId,
                corretor_id: corretorId,
                empreendimento_id: empreendimento.id,
                produto_id: produtos[0].id,
                status: 'Em negociação',
                valor_venda: valorFinal,
                desconto_valor: plano.desconto_valor,
                desconto_percentual: plano.desconto_percentual,
                entrada_valor: plano.entrada_valor,
                entrada_percentual: plano.entrada_percentual,
                num_parcelas_entrada: plano.num_parcelas_entrada,
                data_primeira_parcela_entrada: plano.data_primeira_parcela_entrada,
                parcelas_obra_valor: plano.parcelas_obra_valor,
                parcelas_obra_percentual: plano.parcelas_obra_percentual,
                num_parcelas_obra: plano.num_parcelas_obra,
                data_primeira_parcela_obra: plano.data_primeira_parcela_obra,
                saldo_remanescente_valor: plano.saldo_remanescente_valor,
                plano_proposta: plano,
                produtos_proposta: produtos,
            })
            .select('id')
            .single();

        if (erroSimulacao) {
            console.error('Erro ao salvar simulação:', erroSimulacao);
            throw new Error('Falha ao salvar os dados da simulação.');
        }

        const { data: funil } = await supabase
            .from('funis')
            .select('id')
            .eq('empreendimento_id', empreendimento.id)
            .single();

        if (!funil) {
            console.warn(`Nenhum funil de vendas encontrado para o empreendimento ${empreendimento.id}. O card não foi criado.`);
            return NextResponse.json({ success: true, message: 'Proposta enviada com sucesso! (Funil não configurado)' });
        }

        const { data: primeiraColuna } = await supabase
            .from('colunas_funil')
            .select('id')
            .eq('funil_id', funil.id)
            .order('ordem', { ascending: true })
            .limit(1)
            .single();

        if (!primeiraColuna) {
            console.warn(`Nenhuma coluna encontrada para o funil ${funil.id}. O card não foi criado.`);
             return NextResponse.json({ success: true, message: 'Proposta enviada com sucesso! (Coluna do funil não configurada)' });
        }

        const { error: erroFunil } = await supabase
            .from('contatos_no_funil')
            .insert({
                contato_id: clienteId,
                coluna_id: primeiraColuna.id,
                simulacao_id: simulacaoSalva.id,
                produto_id: produtos[0].id,
                corretor_id: corretorId, // <-- LINHA ADICIONADA AQUI
            });

        if (erroFunil && erroFunil.code !== '23505') { 
            console.warn('Não foi possível adicionar o contato ao funil:', erroFunil.message);
        }

        return NextResponse.json({ success: true, message: 'Proposta enviada e card criado no funil com sucesso!' });

    } catch (error) {
        console.error('Erro no processamento da proposta:', error);
        return NextResponse.json({ error: error.message || 'Ocorreu um erro inesperado.' }, { status: 500 });
    }
}