import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Força carregamento dinâmico
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function GET(request) {
  try {
    // 1. Validação de Segurança (Apenas quem tem a chave pode rodar o Cron em prod)
    const authHeader = request.headers.get('authorization');
    const envSecret = process.env.CRON_SECRET;
    
    if (process.env.NODE_ENV === 'production' && envSecret) {
      if (authHeader !== `Bearer ${envSecret}`) {
        return NextResponse.json({ error: 'Não autorizado. CRON_SECRET inválido ou ausente.' }, { status: 401 });
      }
    }

    console.log('--- [CRON Stella] Iniciando Processamento de Atividades Pendentes ---');

    // 2. Conexão Admin com Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Credenciais do Supabase não configuradas no servidor.");
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Buscar todas as atividades da Stella que estão "Não iniciado"
    const { data: pendentes, error: queryError } = await supabaseAdmin
      .from('activities')
      .select('*')
      .eq('status', 'Não iniciado')
      .eq('tipo_atividade', 'Evento')
      .eq('responsavel_texto', 'Stella IA');

    if (queryError) {
      console.error('[CRON Stella Error] Erro ao buscar atividades no banco:', queryError.message);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!pendentes || pendentes.length === 0) {
      console.log('[CRON Stella] Nenhuma atividade da Stella pendente.');
      return NextResponse.json({ message: 'Sem atividades pendentes.' }, { status: 200 });
    }

    // 4. Filtrar Atividades Vencidas no Fuso de Brasília (UTC-3)
    const agora = new Date();
    const dataHojeStr = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // Retorna YYYY-MM-DD
    const horaAgoraStr = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); // Retorna HH:MM:SS
    const dataRefAgora = `${dataHojeStr} ${horaAgoraStr}`;

    console.log(`[CRON Stella] Data/Hora Atual Brasília: ${dataRefAgora}`);

    const vencidas = pendentes.filter(act => {
      if (!act.data_inicio_prevista) return false;
      const horaStr = act.hora_inicio || '09:00:00';
      const dataRefAgendada = `${act.data_inicio_prevista} ${horaStr}`;
      return dataRefAgendada <= dataRefAgora;
    });

    console.log(`[CRON Stella] Encontradas ${vencidas.length} atividades vencidas/no horário.`);

    if (vencidas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma atividade no horário de disparo.' }, { status: 200 });
    }

    // 5. Processar Lote (Limite de 5 atividades por minuto por segurança de rate limit)
    const LIMIT_RUN = 5;
    const loteParaProcessar = vencidas.slice(0, LIMIT_RUN);
    const resultados = [];

    for (const act of loteParaProcessar) {
      try {
        console.log(`[CRON Stella] Processando Atividade ID ${act.id} para Contato ID ${act.contato_id}...`);

        // A. Buscar telefone do contato
        const { data: telefones, error: telError } = await supabaseAdmin
          .from('telefones')
          .select('telefone')
          .eq('contato_id', act.contato_id)
          .limit(1);

        if (telError) throw telError;

        const telefoneDestino = telefones?.[0]?.telefone;
        if (!telefoneDestino) {
          console.warn(`[CRON Stella Warning] Contato ID ${act.contato_id} sem telefone cadastrado. Cancelando atividade.`);
          await supabaseAdmin
            .from('activities')
            .update({ 
              status: 'Cancelado', 
              descricao: `${act.descricao || ''}\n[Cancelado automaticamente: Contato sem telefone cadastrado]` 
            })
            .eq('id', act.id);
          resultados.push({ id: act.id, status: 'cancelada_sem_telefone' });
          continue;
        }

        // B. Buscar histórico de mensagens da conversa (últimas 20 msgs)
        const { data: messages } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('content, direction, sent_at')
          .eq('contato_id', act.contato_id)
          .eq('organizacao_id', act.organizacao_id)
          .order('sent_at', { ascending: false })
          .limit(20);

        const reversedMessages = [...(messages || [])].reverse();
        const chatLog = reversedMessages.filter(m => m.content).map(m => {
          const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
          return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
        }).join('\n');

        // C. Chamar o Gemini para gerar a resposta de acompanhamento humanizada
        const model = genAI.getGenerativeModel({
          model: 'gemini-3.1-pro-preview',
          generationConfig: {
            responseMimeType: "application/json",
          }
        });

        const prompt = `
Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Você está realizando um retorno de contato automático que foi agendado anteriormente.

# Detalhes da Tarefa de Acompanhamento Agendada:
- Título da tarefa: ${act.nome}
- Motivo/Descrição da tarefa: ${act.descricao}
- Data agendada: ${act.data_inicio_prevista} ${act.hora_inicio}

# Histórico Recente de Conversa (WhatsApp):
${chatLog}

# Sua Missão:
Escreva a mensagem exata de acompanhamento/retorno para enviar ao cliente no WhatsApp agora.

# Regras Críticas para a Mensagem:
1. **Seja Extremamente Natural e Humana**: A mensagem deve parecer escrita por uma pessoa real, de forma amigável, acolhedora e empática.
2. **Contexto Exato**: Use o motivo da tarefa e o histórico da conversa. Por exemplo:
   - Se o cliente disse que estava viajando e voltava na segunda, pergunte como foi a viagem ou diga que está chamando como prometido.
   - Se o cliente disse que só podia falar após as 18h, mencione que está entrando em contato agora no horário sugerido por ele.
   - Se o cliente pediu para ser lembrado em 5 minutos, traga o lembrete de volta de forma simpática.
3. **WhatsApp Style**: Escreva uma mensagem muito sucinta (máximo 2 a 3 linhas por parágrafo, no máximo 1 ou 2 parágrafos). Use emojis de forma amigável e natural.
4. **Termine com uma Pergunta Curta**: Conclua com uma única pergunta simples para engajar o cliente e incentivar a resposta.
5. **Sem placeholders ou tags**: Escreva apenas o texto final pronto para envio. Nenhuma marcação, nenhuma tag, nenhum "Olá [Nome]" se você não sabe o nome do cliente. Se souber o nome do cliente (veja no histórico ou na tarefa), use-o de forma natural.

Retorne um JSON no formato:
{
  "mensagem": "Texto final da mensagem a ser enviada no WhatsApp"
}
        `;

        const result = await model.generateContent([{ text: prompt }]);
        const textOutput = result.response.text();

        let generatedMessage = '';
        try {
          const cleanString = textOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
          const parsed = JSON.parse(cleanString);
          generatedMessage = parsed.mensagem || parsed.response || '';
        } catch (jsonErr) {
          console.error('[CRON Stella Error] Falha ao parsear JSON do Gemini, usando texto bruto:', textOutput, jsonErr.message);
          generatedMessage = textOutput.trim();
        }

        if (!generatedMessage || generatedMessage.length === 0) {
          throw new Error('A mensagem gerada pela inteligência artificial está vazia.');
        }

        // D. Enviar no WhatsApp chamando a API local (/api/whatsapp/send)
        const sendUrl = `${request.nextUrl.origin}/api/whatsapp/send`;
        console.log(`[CRON Stella] Disparando lembrete via: ${sendUrl}`);

        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: telefoneDestino,
            type: 'text',
            text: generatedMessage,
            contact_id: act.contato_id,
            organizacao_id: act.organizacao_id
          })
        });

        const sendResult = await sendResponse.json();
        
        if (!sendResponse.ok) {
          throw new Error(`Erro retornado pela API local: ${sendResult.error || 'Erro desconhecido no envio'}`);
        }

        // E. Concluir atividade no banco
        await supabaseAdmin
          .from('activities')
          .update({
            status: 'Concluído',
            data_fim_real: dataHojeStr,
            descricao: `${act.descricao || ''}\n[Enviado automaticamente pela Stella IA em ${dataHojeStr} às ${horaAgoraStr}]`
          })
          .eq('id', act.id);

        // F. Inserir nota no CRM (se o lead estiver no funil comercial)
        try {
          const { data: funil } = await supabaseAdmin
            .from('contatos_no_funil')
            .select('id')
            .eq('contato_id', act.contato_id)
            .maybeSingle();

          if (funil?.id) {
            await supabaseAdmin
              .from('crm_notas')
              .insert({
                contato_no_funil_id: funil.id,
                contato_id: act.contato_id,
                conteudo: `🤖 [Piloto Automático Stella] Retorno de contato realizado automaticamente via WhatsApp: "${generatedMessage}"`,
                organizacao_id: act.organizacao_id
              });
          }
        } catch (noteErr) {
          console.warn('[CRON Stella Warning] Falha ao registrar nota de CRM para o contato:', noteErr.message);
        }

        console.log(`[CRON Stella] Atividade ID ${act.id} concluída com sucesso.`);
        resultados.push({ id: act.id, status: 'sucesso', mensagem: generatedMessage });

      } catch (err) {
        console.error(`[CRON Stella Error] Falha ao processar atividade ID ${act.id}:`, err.message);
        resultados.push({ id: act.id, status: 'erro', erro: err.message });
      }

      // Pequeno timeout entre envios para rate limiting natural
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      message: 'Processamento de atividades concluído',
      lote_tamanho: loteParaProcessar.length,
      resultados
    }, { status: 200 });

  } catch (fatalError) {
    console.error('[CRON Stella Fatal Error]', fatalError);
    return NextResponse.json({ error: 'Erro interno no servidor cron.', detalhe: fatalError.message }, { status: 500 });
  }
}
