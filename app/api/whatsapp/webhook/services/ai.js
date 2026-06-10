import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Cliente de administração do Supabase para registrar logs
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function transcribeAudioSync(publicUrl, mimeType, contatoId = null, organizacaoId = null) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[Transcription] Chave GEMINI_API_KEY ausente.');
      return null;
    }
    
    console.log(`[Transcription] Iniciando download do audio para IA: ${publicUrl}`);
    const audioRes = await fetch(publicUrl);
    if (!audioRes.ok) throw new Error('Falha no fetch do audio');
    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    
    // Normalizando fallback de audio
    const formattedMime = mimeType && mimeType.includes('audio') ? mimeType : 'audio/ogg';

    console.log(`[Transcription] Audio convertido (${base64Audio.substring(0,20)}...)... Invocando Gemini...`);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          transcricao: { type: SchemaType.STRING, description: "A transcrição exata e clara do áudio sem adicionar comentários." }
        },
        required: ["transcricao"]
      }
    };
    
    // Modelo estável final gemini-3.1-flash-lite
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite", generationConfig });
    
    const prompt = "Você é um excelente transcritor. Ouça este áudio e retorne APENAS o texto falado exatamente como ele é dito (transcrição). Se não houver nada compreensível, retorne '[Áudio Inaudível]'.";
    
    const result = await model.generateContent([
       prompt,
       {
          inlineData: {
            data: base64Audio,
            mimeType: formattedMime
          }
       }
    ]);
    
    const responseText = result.response.text();
    const json = JSON.parse(responseText);
    
    console.log(`[Transcription] Sucesso: ${json.transcricao}`);

    // --- CÁLCULO E LOG DE CUSTO DO ÁUDIO ---
    try {
      const usageMetadata = result.response.usageMetadata;
      if (usageMetadata) {
        const inputTokens = usageMetadata.promptTokenCount || 0;
        const outputTokens = usageMetadata.candidatesTokenCount || 0;
        
        // Gemini 3.1 Flash-Lite: $0.25 entrada / $1.50 saída por milhão
        const inputCost = inputTokens * 0.00000025;
        const outputCost = outputTokens * 0.0000015;
        const costUSD = parseFloat((inputCost + outputCost).toFixed(8));

        if (contatoId && organizacaoId) {
          // Gravar log assíncrono na tabela app_logs
          supabaseAdmin.from('app_logs').insert({
            origem: 'GEMINI COST',
            mensagem: `Custo Stella (gemini-3.1-flash-lite) - Transcrição de Áudio para contato ID ${contatoId}: $${costUSD.toFixed(6)} USD (Tokens: ${inputTokens} entrada / ${outputTokens} saída)`,
            payload: {
              contato_id: contatoId,
              organizacao_id: organizacaoId,
              model: 'gemini-3.1-flash-lite',
              context: 'Transcrição de Áudio',
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cost_usd: costUSD
            },
            organizacao_id: organizacaoId
          }).then(({ error }) => {
            if (error) console.error('[Transcription Cost Log Error] Falha ao salvar log de custo:', error.message);
          });
        }
      }
    } catch (logErr) {
      console.error('[Transcription Cost Log Error] Erro ao calcular/registrar custo:', logErr);
    }
    
    return json.transcricao;
  } catch (error) {
    console.error('[Transcription] Erro ao transcrever:', error);
    return null;
  }
}
