// scripts/disparar-reativacao-fim-de-semana.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PENDENTES = [
  { id: 5420, nome: 'Amanda Silva', org: 2 },
  { id: 6023, nome: 'Reginaldo dos Santos', org: 2 },
  { id: 6025, nome: 'Luana Lima', org: 2 },
  { id: 6030, nome: 'Marlucio Fernandes', org: 2 },
  { id: 6037, nome: 'Ricardo Araujo Mariz', org: 2 },
  { id: 6042, nome: 'Pedro Ferreira', org: 2 }
];

async function run() {
  console.log('⚡ Iniciando reativação em lote para leads do final de semana...');
  console.log('Garantindo que o autopilot está ativo para todos no banco...');

  // Garantir que todos estejam com ia_atendimento_ativo = true antes de disparar o trigger
  for (const lead of PENDENTES) {
    const { error } = await supabase
      .from('contatos')
      .update({ ia_atendimento_ativo: true })
      .eq('id', lead.id);

    if (error) {
      console.error(`❌ Erro ao ativar autopilot para ${lead.nome} (ID ${lead.id}):`, error.message);
    } else {
      console.log(`   [Autopilot Ativado] ${lead.nome} (ID ${lead.id})`);
    }
  }

  // Descobrir qual porta do localhost está ativa
  const ports = ['3000', '3001'];
  let activePort = null;

  for (const port of ports) {
    const testUrl = `http://localhost:${port}/api/cron/process-activities`;
    try {
      console.log(`Testando conexão na porta ${port}...`);
      const testRes = await fetch(testUrl, { method: 'HEAD' });
      if (testRes.status !== 404) { // Qualquer resposta indica que o servidor está lá
        activePort = port;
        break;
      }
    } catch (e) {
      // Porta inativa
    }
  }

  if (!activePort) {
    console.error('\n❌ ERRO CRÍTICO: Servidor local inativo.');
    console.error('Por favor, abra outro terminal, inicie o servidor local com "npm run dev" e execute este script novamente.');
    process.exit(1);
  }

  console.log(`\n✅ Servidor local detectado na porta ${activePort}!`);

  for (const lead of PENDENTES) {
    const triggerUrl = `http://localhost:${activePort}/api/whatsapp/trigger-autopilot`;
    console.log(`\nDisparando trigger de reativação para ${lead.nome} (ID ${lead.id})...`);
    
    try {
      const response = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contato_id: lead.id,
          organizacao_id: lead.org
        })
      });

      const resData = await response.json();
      if (response.ok) {
        console.log(`🎉 Sucesso! Lead ${lead.nome}:`, resData);
      } else {
        console.warn(`⚠️ Aviso no trigger para ${lead.nome} (Status ${response.status}):`, resData);
      }
    } catch (err) {
      console.error(`❌ Erro na conexão para ${lead.nome}:`, err.message);
    }
  }

  console.log('\n🏁 Reativação em lote concluída!');
}

run().catch(console.error);
