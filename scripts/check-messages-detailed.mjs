import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Achar o contato do Ranniere
  const { data: cw } = await supabaseAdmin.from('whatsapp_conversations')
    .select('id, contato_id')
    .eq('phone_number', '553391912291')
    .maybeSingle();
  
  console.log("=== CONVERSA WHATSAPP DETECTADA ===");
  console.log(cw);

  if (!cw || !cw.contato_id) {
    console.log("Nenhuma conversa associada ao telefone do Ranniere.");
    return;
  }

  const contatoId = cw.contato_id;

  // 2. Buscar todas as mensagens daquele contato (últimas 24h)
  const { data: msgs, error } = await supabaseAdmin.from('whatsapp_messages')
    .select('id, content, direction, created_at, sent_at, message_id')
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Erro ao buscar mensagens:", error.message);
    return;
  }

  console.log(`\n=== HISTÓRICO DE MENSAGENS COM O RANNIERE (ID: ${contatoId}) ===`);
  const logs = msgs.map(m => ({
    ID: m.id,
    Hora: new Date(m.created_at).toLocaleTimeString('pt-BR'),
    Direcao: m.direction.toUpperCase(),
    Conteudo: m.content ? (m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content) : '[Sem conteúdo/Mídia]',
    Delay: ''
  }));

  // Calcular diferença de tempo entre mensagens consecutivas para ver latência de resposta
  for (let i = 1; i < logs.length; i++) {
    const dataAtual = new Date(msgs[i].created_at);
    const dataAnterior = new Date(msgs[i-1].created_at);
    const diffSeconds = Math.round((dataAtual - dataAnterior) / 1000);
    if (diffSeconds < 60) {
      logs[i].Delay = diffSeconds + "s";
    } else {
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;
      logs[i].Delay = `${minutes}m ${seconds}s`;
    }
  }

  console.table(logs);
}

run();
