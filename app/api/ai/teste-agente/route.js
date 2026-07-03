import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
  try {
    const { history, message, organizacao_id } = await request.json();

    if (!message || !organizacao_id) {
      return NextResponse.json({ error: 'Faltam parâmetros: message e organizacao_id' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Declaração das Ferramentas (Functions) que o Gemini pode usar
    const tools = [
      {
        functionDeclarations: [
          {
            name: "pesquisar_ficha_empreendimento",
            description: "Pesquisa a ficha técnica completa de um empreendimento no banco de dados pelo seu nome. Retorna informações como área, responsáveis, alvará, e status.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                nome_empreendimento: {
                  type: SchemaType.STRING,
                  description: "Nome ou trecho do nome do empreendimento (ex: 'Braúnas', 'Alfa', 'Beta')"
                }
              },
              required: ["nome_empreendimento"]
            }
          },
          {
            name: "pesquisar_unidades_disponiveis",
            description: "Busca a lista de unidades (produtos) atualmente com status 'Disponível' para um determinado empreendimento. Retorna o nome da unidade, metragem e valor de venda.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                 nome_empreendimento: {
                  type: SchemaType.STRING,
                  description: "Nome ou trecho do nome do empreendimento (ex: 'Braúnas', 'Alfa', 'Beta')"
                }
              },
              required: ["nome_empreendimento"]
            }
          }
        ]
      }
    ];

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      tools: tools,
      systemInstruction: `Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Sua missão é gerar uma RESPOSTA SUGERIDA PRONTA natural e humanizada para o corretor copiar e enviar ao cliente no WhatsApp.
Você tem acesso a banco de dados em tempo real através de ferramentas (functions). Se o cliente perguntar sobre unidades disponíveis, consulte o banco ANTES de responder. 
IMPORTANTE: Se a pergunta for genérica (ex: "qual a unidade mais barata?") e não citar o nome do empreendimento, PERGUNTE ao usuário qual empreendimento ele deseja pesquisar (Alfa, Beta ou Braúnas) ANTES de usar a ferramenta.
A resposta sugerida não deve parecer um robô corporativo, deve ser natural e direta, como um excelente vendedor faria no WhatsApp.
Evite jargões engessados como 'Realizei uma varredura sistêmica'. Seja ágil e agradável.
JAMAIS chame o cliente de "seu lindo", chame-o apenas pelo nome se souber, ou trate-o de forma educada e comercial.`
    });

    const chat = model.startChat({
      history: history || []
    });

    // Envia a mensagem para o Gemini
    let result = await chat.sendMessage(message);

    // Verifica se o Gemini pediu para rodar alguma função
    let functionCalls = result.response.functionCalls();
    
    // Podemos ter múltiplas interações de funções antes de receber o texto final
    // Vamos limitar a um máximo de 5 iterações para evitar loops infinitos
    let maxIterations = 5;
    let iteration = 0;

    while (functionCalls && iteration < maxIterations) {
      iteration++;
      const functionResponses = [];

      for (const call of functionCalls) {
        if (call.name === "pesquisar_ficha_empreendimento") {
          const args = call.args;
          const { data, error } = await supabaseAdmin
            .from('empreendimentos')
            .select('*')
            .eq('organizacao_id', organizacao_id)
            .ilike('nome', `%${args.nome_empreendimento}%`)
            .limit(1);

          if (error) {
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: error.message }
              }
            });
          } else if (data && data.length > 0) {
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { data: data[0] }
              }
            });
          } else {
             functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: `Nenhum empreendimento encontrado contendo o nome '${args.nome_empreendimento}' para esta organização.` }
              }
            });
          }
        } 
        else if (call.name === "pesquisar_unidades_disponiveis") {
          const args = call.args;
          
          // Primeiro, encontra o empreendimento
          const { data: empData, error: empError } = await supabaseAdmin
            .from('empreendimentos')
            .select('id, nome')
            .eq('organizacao_id', organizacao_id)
            .ilike('nome', `%${args.nome_empreendimento}%`)
            .limit(1);
          
          if (empError || !empData || empData.length === 0) {
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: `Não encontrei o empreendimento '${args.nome_empreendimento}'. Não é possível listar unidades.` }
              }
            });
          } else {
            // Agora, busca os produtos disponíveis
            const { data: prodData, error: prodError } = await supabaseAdmin
              .from('produtos_empreendimento')
              .select('id, unidade, tipo, area_m2, valor_venda_calculado, status, pavimento, bloco, descricao')
              .eq('empreendimento_id', empData[0].id)
              .eq('status', 'Disponível');
              
            if (prodError) {
               functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { error: prodError.message }
                }
              });
            } else {
               functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { 
                    empreendimento_encontrado: empData[0].nome,
                    total_disponivel: prodData.length,
                    unidades: prodData 
                  }
                }
              });
            }
          }
        }
      }

      // Devolvemos o resultado das funções para o Gemini processar
      result = await chat.sendMessage(functionResponses);
      functionCalls = result.response.functionCalls();
    }

    // Pega o texto final da resposta
    let finalResponseText = '';
    try {
      finalResponseText = result.response.text();
    } catch(e) {
      console.warn("Nenhum texto retornado pelo modelo.");
    }

    if (!finalResponseText || finalResponseText.trim() === '') {
       finalResponseText = "Ops, minha linha de raciocínio travou ao ler os dados. Você pode especificar de qual empreendimento (Alfa, Beta ou Braúnas) você está falando?";
    }
    
    // Prepara o histórico atualizado para o frontend usar na próxima requisição
    const updatedHistory = await chat.getHistory();

    return NextResponse.json({ 
      text: finalResponseText,
      history: updatedHistory
    });

  } catch (error) {
    console.error('[Agent Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


