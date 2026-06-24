export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { processarAnaliseStella as processarStella } from '../stella/processor';

/**
 * Função de retrocompatibilidade para chamada direta de processarAnaliseStella em JS.
 */
export async function processarAnaliseStella(params) {
  return await processarStella(params);
}

/**
 * Rota POST para invocação HTTP da análise de chat (/api/ai/chat-analysis)
 */
export async function POST(request) {
  try {
    const params = await request.json();
    const result = await processarStella(params);
    
    if (result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[AI API POST Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
