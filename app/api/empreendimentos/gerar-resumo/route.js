import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Força a rota a ser sempre dinâmica, o que é bom para funções de IA
export const dynamic = 'force-dynamic';

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- FUNÇÃO PRINCIPAL DA ROTA ---
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { empreendimentoId } = await request.json();
        if (!empreendimentoId) {
            return new NextResponse(JSON.stringify({ error: 'ID do empreendimento é obrigatório.' }), { status: 400 });
        }

        // 1. BUSCAR DADOS ESTRUTURADOS DO BANCO DE DADOS
        const { data: empreendimento, error: empError } = await supabase
            .from('empreendimentos')
            .select('*')
            .eq('id', empreendimentoId)
            .single();

        if (empError || !empreendimento) throw new Error('Empreendimento não encontrado.');

        const { data: produtos, error: prodError } = await supabase
            .from('produtos_empreendimento')
            .select('status')
            .eq('empreendimento_id', empreendimentoId);

        // 2. BUSCAR CONHECIMENTO NÃO ESTRUTURADO DA MEMÓRIA DA IA
        const { data: documentos, error: docError } = await supabase
            .from('empreendimento_documento_embeddings')
            .select('content')
            .eq('empreendimento_id', empreendimentoId);

        // 3. COMPILAR TODAS AS INFORMAÇÕES PARA A IA
        const totalUnidades = produtos?.length || 0;
        const unidadesDisponiveis = produtos?.filter(p => p.status === 'Disponível').length || 0;

        let promptContext = `
            ## Ficha Técnica do Empreendimento (Dados do Sistema):
            - **Nome do Empreendimento:** ${empreendimento.nome}
            - **Status Atual:** ${empreendimento.status}
            - **Endereço:** ${empreendimento.address_street || ''}, ${empreendimento.address_number || ''}, ${empreendimento.neighborhood || ''}, ${empreendimento.city || ''} - ${empreendimento.state || ''}
            - **Total de Unidades:** ${totalUnidades}
            - **Unidades Disponíveis:** ${unidadesDisponiveis}
            - **Índice de Reajuste:** ${empreendimento.indice_reajuste || 'Não informado'}
        `;

        if (documentos && documentos.length > 0) {
            const documentText = documentos.map(d => d.content).join('\n\n');
            promptContext += `
                \n## Conteúdo Extraído dos Documentos (Material de Apoio):
                ${documentText}
            `;
        }

        // 4. CRIAR O PROMPT PERFEITO PARA A IA
        const promptFinal = `
            Você é a Stella, uma especialista em marketing imobiliário do Studio 57.
            Sua tarefa é analisar todas as informações fornecidas sobre um empreendimento e gerar um texto de apresentação completo, profissional e persuasivo para ser enviado a um cliente.

            Organize a resposta nas seguintes seções:
            1.  **Título:** Crie um título atrativo para o empreendimento.
            2.  **Introdução:** Um parágrafo curto e convidativo que apresenta o empreendimento.
            3.  **Características Principais:** Use bullets (pontos) para listar os destaques e diferenciais.
            4.  **Sobre as Unidades:** Detalhes sobre os apartamentos ou casas, se houver.
            5.  **Localização:** Descreva os benefícios da localização.
            6.  **Conclusão:** Um fechamento que convide o cliente a saber mais.

            Use as informações abaixo como base. NÃO invente informações que não estão aqui.

            --- INÍCIO DAS INFORMAÇÕES ---
            ${promptContext}
            --- FIM DAS INFORMAÇÕES ---

            Agora, gere a apresentação completa do empreendimento.
        `;

        // 5. GERAR E RETORNAR O RESUMO
        const result = await generativeModel.generateContent(promptFinal);
        const response = await result.response;
        const summary = response.text();
        
        return NextResponse.json({ summary });

    } catch (error) {
        console.error("[gerar-resumo] Erro:", error);
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}