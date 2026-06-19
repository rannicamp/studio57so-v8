import { SchemaType } from '@google/generative-ai';
import { generateContentWithTelemetry } from '../../../../../utils/gemini';

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
    
    const prompt = "Você é um excelente transcritor. Ouça este áudio e retorne APENAS o texto falado exatamente como ele é dito (transcrição). Se não houver nada compreensível, retorne '[Áudio Inaudível]'.";
    
    const promptParts = [
      prompt,
      {
        inlineData: {
          data: base64Audio,
          mimeType: formattedMime
        }
      }
    ];

    // Chamando o Gemini via wrapper de telemetria
    const result = await generateContentWithTelemetry({
      modelName: 'gemini-3.1-flash-lite',
      promptContent: promptParts,
      generationConfig,
      origem: 'whatsapp-webhook-services-ai',
      context: 'Transcrição de Áudio',
      contatoId,
      organizacaoId
    });
    
    const responseText = result.response.text();
    const json = JSON.parse(responseText);
    
    console.log(`[Transcription] Sucesso: ${json.transcricao}`);
    return json.transcricao;
  } catch (error) {
    console.error('[Transcription] Erro ao transcrever:', error);
    return null;
  }
}
