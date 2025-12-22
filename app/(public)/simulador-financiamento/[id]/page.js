// app/(public)/simulador-financiamento/[id]/page.js
import { createClient } from '@/utils/supabase/server';
import SimuladorFinanceiroPublico from '@/components/SimuladorFinanceiroPublico';
import { notFound } from 'next/navigation';

export const revalidate = 0;

// Função para buscar todos os dados necessários para o simulador
async function getInitialData(id) {
    const supabase = await createClient();
    
    // 1. Busca a simulação pelo ID
    const { data: simulacao, error: simError } = await supabase
        .from('simulacoes')
        .select('*')
        .eq('id', id)
        .single();

    if (simError || !simulacao) {
        console.error("Simulação não encontrada:", simError);
        return null;
    }

    // 2. Busca todos os empreendimentos (para o menu de seleção)
    const { data: allEmpreendimentos } = await supabase.from('empreendimentos').select('*').order('nome');

    // 3. Busca dados relacionados à simulação
    const { data: empreendimento } = await supabase.from('empreendimentos').select('*').eq('id', simulacao.empreendimento_id).single();
    const { data: produtosEmpreendimento } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', simulacao.empreendimento_id);
    const { data: contato } = await supabase.from('contatos').select('*, telefones(telefone), emails(email)').eq('id', simulacao.contato_id).single();
    
    let corretor = null;
    if (simulacao.corretor_id) {
        const { data: corretorData } = await supabase.from('contatos').select('*').eq('id', simulacao.corretor_id).single();
        corretor = corretorData;
    }

    return {
        simulacao,
        empreendimento,
        contato,
        corretor,
        produtosEmpreendimento,
        allEmpreendimentos
    };
}

export default async function SimuladorPreenchidoPage({ params }) {
    const initialData = await getInitialData(params.id);

    if (!initialData) {
        notFound();
    }

    return (
        <SimuladorFinanceiroPublico
            allEmpreendimentos={initialData.allEmpreendimentos}
            initialData={initialData} 
        />
    );
}