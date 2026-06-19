import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateContentWithTelemetry } from '@/utils/gemini';

export const dynamic = 'force-dynamic';

// --- FUNÇÃO PRINCIPAL DA ROTA ---
export async function POST(request) {
 try {
 const supabase = await createClient();

 const { empreendimentoId } = await request.json();
 if (!empreendimentoId) {
 throw new Error('ID do empreendimento é obrigatório.');
 }

 // O restante do código continua exatamente o mesmo...
 const { data: empreendimento, error: empError } = await supabase
 .from('empreendimentos')
 .select('*')
 .eq('id', empreendimentoId)
 .single();

 if (empError) throw new Error(`Erro ao buscar empreendimento: ${empError.message}`);
 if (!empreendimento) throw new Error('Empreendimento não encontrado.');

 const { data: produtos } = await supabase
 .from('produtos_empreendimento')
 .select('status')
 .eq('empreendimento_id', empreendimentoId);

 const { data: documentos } = await supabase
 .from('empreendimento_documento_embeddings')
 .select('content')
 .eq('empreendimento_id', empreendimentoId);

 const totalUnidades = produtos?.length || 0;
 const unidadesDisponiveis = produtos?.filter(p => p.status === 'Disponível').length || 0;

 let promptContext = `
 ## Ficha Técnica do Empreendimento (Dados do Sistema):
 - Nome do Empreendimento: ${empreendimento.nome || 'Não informado'}
 - Status Atual: ${empreendimento.status || 'Não informado'}
 - Endereço: ${empreendimento.address_street || ''}, ${empreendimento.address_number || ''}, ${empreendimento.neighborhood || ''}
 - Total de Unidades: ${totalUnidades}
 - Unidades Disponíveis: ${unidadesDisponiveis}
 - Índice de Reajuste: ${empreendimento.indice_reajuste || 'Não informado'}
 `;

 if (documentos && documentos.length > 0) {
 const documentText = documentos.map(d => d.content).join('\n\n');
 promptContext += `
 \n## Conteúdo Extraído dos Documentos (Material de Apoio):
 ${documentText}
 `;
 }

 const promptFinal = `
 Você é a Stella, uma especialista em marketing imobiliário do Studio 57.
 Sua tarefa é analisar todas as informações fornecidas sobre um empreendimento e gerar um texto de apresentação completo, profissional e persuasivo para ser enviado a um cliente.
 Organize a resposta em seções claras (Introdução, Características, etc.).
 Use as informações abaixo como base. NÃO invente informações.

 --- INÍCIO DAS INFORMAÇÕES ---
 ${promptContext}
 --- FIM DAS INFORMAÇÕES ---

 Gere a apresentação completa do empreendimento.
 `;

 const result = await generateContentWithTelemetry({
    modelName: 'gemini-3.1-flash-lite',
    promptContent: promptFinal,
    origem: '/api/empreendimentos/gerar-resumo',
    context: 'Geração de Apresentação de Empreendimento'
  });
 const response = await result.response;
 const summary = response.text();
 return NextResponse.json({ summary });

 } catch (error) {
 console.error("[gerar-resumo] Erro pego:", error);
 return NextResponse.json(
 { error: error.message || "Ocorreu um erro desconhecido no servidor." },
 { status: 500 }
 );
 }
}