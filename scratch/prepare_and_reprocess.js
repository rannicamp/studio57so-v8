// scratch/prepare_and_reprocess.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LEADS_REPROCESSAR = [
  { contato_id: 6067, nome: 'Geneci Dutra', from: '17814089929' },
  { contato_id: 3401, nome: 'Cássila Gonçalves', from: '17816058301' },
  { contato_id: 3467, nome: 'Guilherme Ruas / Will', from: '15084319236' },
  { contato_id: 6051, nome: 'Téo Rodrigues Costa', from: '5532988971483' },
  { contato_id: 6058, nome: 'Mariza Dias Lima', from: '5533988840462' }
];

const COLUNA_EM_ATENDIMENTO = '029c8d6a-4799-4f4b-a55e-b4d5426718c0';

async function resetLeads() {
  console.log("=== PREPARANDO CONTATOS NO BANCO DE DADOS ===");
  
  for (const lead of LEADS_REPROCESSAR) {
    console.log(`> Resetando Lead: ${lead.nome} (ID: ${lead.contato_id})`);
    
    // 1. Ativar piloto automático
    const { error: errC } = await supabase
      .from('contatos')
      .update({ ia_atendimento_ativo: true })
      .eq('id', lead.contato_id);
      
    if (errC) console.error(`   Erro ao atualizar contatos para ${lead.contato_id}:`, errC.message);
    
    // 2. Mover para a coluna EM ATENDIMENTO
    const { error: errF } = await supabase
      .from('contatos_no_funil')
      .update({ coluna_id: COLUNA_EM_ATENDIMENTO, updated_at: new Date().toISOString() })
      .eq('contato_id', lead.contato_id);
      
    if (errF) console.error(`   Erro ao mover no funil para ${lead.contato_id}:`, errF.message);
  }
}

async function dispararProcessamento() {
  console.log("\n=== DISPARANDO PROCESSAMENTO DA STELLA LOCALMENTE ===");
  
  for (const lead of LEADS_REPROCESSAR) {
    console.log(`\n> Enviando gatilho: ${lead.nome} (ID: ${lead.contato_id})`);
    
    try {
      const response = await fetch('http://localhost:3000/api/ai/stella/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            id: `reprocess-${Date.now()}`,
            contato_id: lead.contato_id,
            organizacao_id: 2,
            direction: 'inbound',
            from: lead.from
          }
        })
      });

      const result = await response.json();
      console.log(`Resposta da API:`, JSON.stringify(result, null, 2));

    } catch (err) {
      console.error(`Erro ao disparar para ${lead.nome}:`, err.message);
    }
  }
}

async function auditarMensagens() {
  console.log("\n=== AGUARDANDO E AUDITANDO ENVIO DE MENSAGENS (30 segundos) ===");
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  const ids = LEADS_REPROCESSAR.map(l => l.contato_id);
  const { data: msgs, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('id, contato_id, content, direction, created_at, status, error_message')
    .in('contato_id', ids)
    .order('created_at', { ascending: false })
    .limit(15);

  if (errM) {
    console.error("Erro ao auditar mensagens:", errM.message);
  } else if (msgs) {
    msgs.reverse().forEach(m => {
      console.log(`[${m.created_at}] [Lead: ${m.contato_id}] ${m.direction.toUpperCase()} | Status: ${m.status} | Erro: ${m.error_message || 'Nenhum'}`);
      console.log(`Conteúdo: "${m.content}"`);
      console.log(`------------------------------------------------------`);
    });
  }
}

async function main() {
  await resetLeads();
  // Delay de 1 segundo
  await new Promise(resolve => setTimeout(resolve, 1000));
  await dispararProcessamento();
  await auditarMensagens();
}

main();
