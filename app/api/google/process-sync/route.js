import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

export async function GET(request) {
  return processQueue(request);
}

export async function POST(request) {
  return processQueue(request);
}

async function processQueue(request) {
  // Esse endpoint é chamado pelo Cron/Scheduler. 
  try {
    const supabase = createAdminClient();

    // 1. Pega até 20 contatos pendentes
    const { data: queueItems, error: fetchError } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) throw fetchError;
    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ message: 'Nenhum contato na fila.' });
    }

    // 2. Marca eles como 'processando' para evitar corrida (Race Condition)
    const queueIds = queueItems.map(q => q.id);
    await supabase
      .from('sync_queue')
      .update({ status: 'processando', updated_at: new Date().toISOString() })
      .in('id', queueIds);

    // 3. Processa cada item sequencialmente com intervalo de segurança
    let successCount = 0;
    let errorCount = 0;

    for (const item of queueItems) {
      try {
        // Reutilizamos a robusta rota de sync individual já existente
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
        const syncRes = await fetch(`${baseUrl}/api/google/sync-contatos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contato_id: item.contato_id,
            organizacao_id: item.organizacao_id,
            user_id: item.user_id
          })
        });

        if (!syncRes.ok) {
          const errorData = await syncRes.json();
          throw new Error(errorData.error || `HTTP ${syncRes.status}`);
        }

        // Se deu sucesso
        await supabase
          .from('sync_queue')
          .update({ status: 'concluido', updated_at: new Date().toISOString() })
          .eq('id', item.id);
          
        successCount++;
      } catch (err) {
        console.error(`Erro ao processar item da fila ${item.id}:`, err);
        // Se deu erro, incrementa tentativas
        const novasTentativas = (item.tentativas || 0) + 1;
        const novoStatus = novasTentativas >= 3 ? 'erro_fatal' : 'erro';

        await supabase
          .from('sync_queue')
          .update({ 
            status: novoStatus, 
            tentativas: novasTentativas,
            mensagem_erro: err.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        errorCount++;
      }

      // 4. Pausa de 2000ms (2s) entre as requisições para poupar a cota de 60 req/min da Google API
      await new Promise(r => setTimeout(r, 2000));
    }

    return NextResponse.json({ 
      success: true, 
      processed: queueItems.length,
      successCount,
      errorCount
    });

  } catch (error) {
    console.error('Erro geral no Processador da Fila:', error);
    return NextResponse.json({ error: 'Erro ao processar fila', details: error.message }, { status: 500 });
  }
}
