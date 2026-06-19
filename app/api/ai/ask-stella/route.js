import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateContentWithTelemetry } from '../../../../utils/gemini';

export async function POST(request) {
  try {
    const { contato_id, organizacao_id, question } = await request.json();

    if (!contato_id || !organizacao_id || !question || !question.trim()) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes.' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Buscar contato e funil para deduzir o empreendimento
    const [contatoResult, funilResult] = await Promise.all([
      supabaseAdmin
        .from('contatos')
        .select('ai_analysis')
        .eq('id', contato_id)
        .eq('organizacao_id', organizacao_id)
        .single(),
      supabaseAdmin
        .from('contatos_no_funil')
        .select(`
          id,
          coluna_id,
          empreendimento_id,
          contatos_no_funil_produtos(
            produto:produto_id(empreendimento_id)
          )
        `)
        .eq('contato_id', contato_id)
        .maybeSingle()
    ]);

    const contatoInfo = contatoResult.data;
    const funil = funilResult.data;

    // Deduzir o ID do Empreendimento de interesse
    let empId = funil?.empreendimento_id || funil?.contatos_no_funil_produtos?.[0]?.produto?.empreendimento_id || contatoInfo?.ai_analysis?.empreendimento_detectado_id;

    if (!empId) {
      // Se não achar nada, pega o primeiro da organização
      const { data: firstEmp } = await supabaseAdmin
        .from('empreendimentos')
        .select('id')
        .eq('organizacao_id', organizacao_id)
        .limit(1)
        .maybeSingle();
      if (firstEmp) empId = firstEmp.id;
    }

    if (!empId) {
      return NextResponse.json({ answer: 'Desculpe, não consegui identificar qual o empreendimento associado a este lead para buscar as informações no dossiê.' });
    }

    // 2. Buscar o Dossiê e Informações do Empreendimento
    const [empResult, produtosResult] = await Promise.all([
      supabaseAdmin
        .from('empreendimentos')
        .select('nome, dossie_ia')
        .eq('id', empId)
        .single(),
      supabaseAdmin
        .from('produtos_empreendimento')
        .select('unidade, area_m2, valor_venda_calculado')
        .eq('empreendimento_id', empId)
        .eq('status', 'Disponível')
        .eq('organizacao_id', organizacao_id)
    ]);

    const empData = empResult.data;
    const produtos = produtosResult.data || [];

    if (!empData) {
      return NextResponse.json({ answer: 'Desculpe, não encontrei o cadastro deste empreendimento no sistema.' });
    }

    const dossie = empData.dossie_ia || 'Nenhum dossiê de inteligência cadastrado para este empreendimento.';
    const produtosContext = produtos.length > 0
      ? produtos.map(p => `- Unidade: ${p.unidade} | Área: ${p.area_m2}m² | Valor: R$ ${p.valor_venda_calculado || 'N/A'}`).join('\n')
      : 'Nenhuma unidade disponível em estoque.';

    // 3. Montar o prompt para a Stella responder ao Corretor
    const prompt = `
Você é a Stella, a inteligência artificial de elite do Studio 57.
Um corretor humano está com dúvidas técnicas sobre o empreendimento "${empData.nome}" e te fez uma pergunta.
Sua missão é responder à dúvida do corretor de forma extremamente profissional, objetiva, precisa e baseada estritamente na base de conhecimento (Dossiê) e estoque do empreendimento listados abaixo.

### BASE DE CONHECIMENTO DO EMPREENDIMENTO (${empData.nome})
${dossie}

### UNIDADES DISPONÍVEIS EM ESTOQUE
${produtosContext}

---
DÚVIDA DO CORRETOR: "${question}"

Regras de Resposta:
1. Responda diretamente e de forma concisa. O corretor precisa de respostas rápidas para passar ao cliente.
2. Use bullet points se ajudar na legibilidade.
3. Se a informação solicitada NÃO estiver no Dossiê nem no estoque, diga de forma honesta: "Desculpe, essa informação não consta no meu dossiê técnico. Por favor, consulte a equipe de engenharia." (NUNCA invente dados).
4. Mantenha um tom prestativo, de colega de equipe e inteligente.

Escreva a resposta final abaixo:
`;

    const result = await generateContentWithTelemetry({
      modelName: 'gemini-3.1-flash-lite',
      promptContent: [{ text: prompt }],
      origem: 'ask-stella',
      context: 'Dúvida do Corretor',
      contatoId: contato_id,
      organizacaoId: organizacao_id
    });
    const answer = result.response.text().trim();

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('[Ask Stella API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
