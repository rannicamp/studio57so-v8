// /utils/stella-sdr.js

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// --- CONSTANTES E CONFIGURAÇÕES ---
const STELLA_USER_ID = 'b265268e-4493-40b7-9862-0bff34dd6799'; // ID de usuário específico da IA
const NOME_FUNIL_VENDAS = 'Funil de Vendas'; // ATENÇÃO: Verifique se este é o nome exato do seu funil no banco

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- A "MÃO" DA SDR: FUNÇÃO QUE EXECUTA AÇÕES NO BANCO ---

/**
 * Esta é a ferramenta que a IA usará para criar um lead no sistema.
 * Ela cria o contato, o telefone, o insere no funil e cria uma atividade.
 */
async function qualificar_e_criar_lead(supabase, { nome_lead, mensagem_original, telefone_lead }) {
    console.log(`[SDR] Iniciando qualificação e criação de lead para: ${nome_lead}`);

    try {
        // 1. Buscar o funil de vendas e sua primeira etapa (coluna)
        const { data: funil, error: funilError } = await supabase
            .from('funis')
            .select('id, colunas_funil(id, ordem)') // Corrigido para usar a tabela 'colunas_funil'
            .eq('nome', NOME_FUNIL_VENDAS)
            .limit(1)
            .single();

        if (funilError || !funil) {
            console.error('[SDR] ERRO: Funil de vendas não encontrado.', funilError);
            return { sucesso: false, erro: "Configuração do funil de vendas não encontrada." };
        }
        
        const primeiraColuna = funil.colunas_funil.sort((a, b) => a.ordem - b.ordem)[0];
        if (!primeiraColuna) {
             console.error('[SDR] ERRO: Nenhuma coluna/etapa encontrada para o funil de vendas.');
             return { sucesso: false, erro: "Nenhuma coluna configurada para o funil de vendas." };
        }

        // 2. Criar o contato
        const { data: novoContato, error: contatoError } = await supabase
            .from('contatos')
            .insert({ nome: nome_lead, observations: 'Lead qualificado e criado via WhatsApp pela IA Stella.' }) // Coluna 'origem' removida, usando 'observations'
            .select('id')
            .single();

        if (contatoError) {
            console.error('[SDR] ERRO ao criar contato:', contatoError);
            return { sucesso: false, erro: "Falha ao registrar o novo contato." };
        }
        const novoContatoId = novoContato.id;

        // 3. Associar o telefone ao contato
        await supabase.from('telefones').insert({
            contato_id: novoContatoId,
            telefone: telefone_lead,
            tipo: 'celular' // Coluna 'is_whatsapp' removida
        });

        // 4. Inserir o contato no funil de vendas (a representação do "card" na coluna)
        const { error: contatosNoFunilError } = await supabase
            .from('contatos_no_funil')
            .insert({
                contato_id: novoContatoId,
                coluna_id: primeiraColuna.id,
            });

        if(contatosNoFunilError) {
             console.error('[SDR] ERRO ao inserir contato no funil:', contatosNoFunilError);
             return { sucesso: false, erro: "Falha ao adicionar o lead no funil de vendas." };
        }

        // 5. Criar uma atividade para registrar a mensagem inicial (o "título" do card)
        const { error: activityError } = await supabase.from('activities').insert({
            nome: `Novo Lead: ${nome_lead}`,
            descricao: `[LEAD CRIADO PELA IA STELLA]\nContato ID: ${novoContatoId}\nMensagem Original: "${mensagem_original}"`,
            criado_por_usuario_id: STELLA_USER_ID,
            status: 'Não iniciado',
            tipo_atividade: 'CRM' // Adicionado tipo para melhor filtragem
        });
        
        if (activityError) {
            // Isso não é um erro crítico, então apenas registramos
             console.warn('[SDR] AVISO: Lead foi criado, mas falhou ao criar a atividade associada.', activityError);
        }
        
        console.log(`[SDR] Lead ${nome_lead} (Contato ID: ${novoContatoId}) criado e inserido no funil com sucesso.`);
        return { sucesso: true, novoContatoId: novoContatoId };

    } catch (error) {
        console.error('[SDR] ERRO INESPERADO no processo de criação de lead:', error);
        return { sucesso: false, erro: "Ocorreu um erro inesperado." };
    }
}


// --- O "CÉREBRO" DA SDR: FUNÇÃO QUE ANALISA A MENSAGEM ---

export async function analisarMensagemDeLead(supabase, messageText, senderPhone, config, sendTextMessage) {
    const systemInstruction = `
        Você é a Stella, uma assistente de vendas (SDR) inteligente e proativa.
        Sua única função neste momento é analisar a PRIMEIRA mensagem de um número de telefone desconhecido.
        Seu objetivo é decidir se a mensagem é de um potencial cliente (um lead).

        Regras:
        1.  Um lead é alguém que demonstra interesse claro em um produto, pede preços, pergunta sobre um empreendimento ou solicita informações de compra.
        2.  Se a mensagem for um lead claro, você DEVE chamar a função 'qualificar_e_criar_lead'. Extraia o nome da pessoa se ela se apresentar. Se não, use "Lead do WhatsApp".
        3.  Se a mensagem for ambígua, um spam, uma saudação simples ("oi", "bom dia") ou não parecer um lead, NÃO FAÇA NADA. Apenas retorne um resultado indicando que não é um lead.
        4.  Nunca responda diretamente ao usuário. Apenas chame a função.
    `;

    const generativeModel = genAI.getGenerativeModel({
        model: "gemini-1.5-pro-latest",
        safetySettings,
        systemInstruction,
        tools: {
            functionDeclarations: [{
                name: "qualificar_e_criar_lead",
                description: "Cria um novo contato no sistema, o insere no funil de vendas e cria uma atividade para ele.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        nome_lead: { type: "STRING", description: "O nome do potencial cliente. Se não for informado, usar 'Lead do WhatsApp'." },
                        mensagem_original: { type: "STRING", description: "A mensagem original e completa enviada pelo cliente." },
                        telefone_lead: { type: "STRING", description: "O número de telefone do lead." }
                    },
                    required: ["nome_lead", "mensagem_original", "telefone_lead"]
                }
            }]
        }
    });

    try {
        const chat = generativeModel.startChat();
        // Passamos a mensagem original para a IA
        const prompt = `Analise a seguinte mensagem de um novo número (${senderPhone}): "${messageText}"`;
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === 'qualificar_e_criar_lead') {
                const args = { ...call.args, telefone_lead: senderPhone };
                
                const resultadoCriacao = await qualificar_e_criar_lead(supabase, args);

                if (resultadoCriacao.sucesso) {
                    const respostaAutomatica = "Olá! Sou a Stella, sua assistente virtual. Recebi seu interesse e já direcionei sua mensagem para nossa equipe. Em breve um de nossos consultores entrará em contato. Agradecemos a sua paciência! 😊";
                    // Usa o novo ID do contato para registrar a mensagem de saída corretamente
                    await sendTextMessage(supabase, config, senderPhone, resultadoCriacao.novoContatoId, respostaAutomatica);
                    return { leadCriado: true, novoContatoId: resultadoCriacao.novoContatoId };
                }
            }
        }
        
        // Se não houver chamada de função ou se a criação falhar, retornamos o status.
        return { leadCriado: false, novoContatoId: null };

    } catch (error) {
        console.error('[SDR] ERRO ao analisar mensagem com a IA:', error);
        return { leadCriado: false, novoContatoId: null };
    }
}