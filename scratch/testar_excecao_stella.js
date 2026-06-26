const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONTACT_ID = 5923; // Lead de teste do Ranniere
const ORGANIZACAO_ID = 2; // Org 2

async function run() {
  console.log('=== TESTE DE VALIDAÇÃO: EXCEÇÃO DA STELLA NO PILOTO AUTOMÁTICO ===');

  // 1. Buscar o ID do usuário da Stella IA
  const { data: stellaUser, error: stellaErr } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', `stella.org${ORGANIZACAO_ID}@elo57.com.br`)
    .maybeSingle();

  if (stellaErr || !stellaUser) {
    console.error('Erro ao buscar usuário da Stella:', stellaErr?.message || 'Não encontrado');
    return;
  }

  const stellaUserId = stellaUser.id;
  console.log(`ID da Stella IA: ${stellaUserId}`);

  // Buscar um ID de usuário humano (qualquer outro da tabela usuarios que não seja a Stella)
  const { data: humanUser, error: humanErr } = await supabase
    .from('usuarios')
    .select('id')
    .neq('id', stellaUserId)
    .limit(1)
    .maybeSingle();

  if (humanErr || !humanUser) {
    console.error('Erro ao buscar usuário humano para o teste:', humanErr?.message || 'Não encontrado');
    return;
  }

  const humanUserId = humanUser.id;
  console.log(`ID do Usuário Humano para Teste: ${humanUserId}`);

  // --- CENÁRIO A: ENVIO PELA STELLA IA (O piloto automático DEVE continuar ATIVO) ---
  console.log('\n--- CENÁRIO A: Envio pela Stella IA ---');
  
  // Garantir que o piloto automático esteja ATIVO antes de enviar
  await supabase
    .from('contatos')
    .update({ ia_atendimento_ativo: true })
    .eq('id', TEST_CONTACT_ID);
  
  console.log('Piloto automático ativado para o lead.');

  // Disparar envio de WhatsApp fingindo ser a Stella (usando usuario_id da Stella)
  const payloadStella = {
    to: '5533991912291',
    type: 'text',
    text: 'Teste de validação de sistema: Stella (Favor desconsiderar).',
    contact_id: TEST_CONTACT_ID,
    organizacao_id: ORGANIZACAO_ID,
    usuario_id: stellaUserId,
    bypass_autopilot: true
  };

  try {
    console.log('Enviando requisição como Stella para /api/whatsapp/send...');
    const response = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadStella)
    });

    console.log(`Status de resposta da API: ${response.status}`);
    if (!response.ok) {
      console.log('Resposta de erro (esperada se der erro de Meta Cloud API, mas o que nos importa é o banco):', await response.text());
    }

    // Verificar se o piloto automático continua ativo no banco
    const { data: contatoPosStella } = await supabase
      .from('contatos')
      .select('ia_atendimento_ativo')
      .eq('id', TEST_CONTACT_ID)
      .single();

    console.log(`Status do Piloto Automático pós-envio Stella: ${contatoPosStella.ia_atendimento_ativo ? 'LIGADO (CORRETO! EXCESSÃO FUNCIONOU!)' : 'DESLIGADO (ERRO!)'}`);

  } catch (err) {
    console.error('Erro ao chamar API no cenário Stella:', err.message);
  }

  // --- CENÁRIO B: ENVIO POR HUMANO (O piloto automático DEVE ser DESLIGADO) ---
  console.log('\n--- CENÁRIO B: Envio por Humano ---');

  // Garantir que o piloto automático esteja ATIVO antes de enviar
  await supabase
    .from('contatos')
    .update({ ia_atendimento_ativo: true })
    .eq('id', TEST_CONTACT_ID);
  
  console.log('Piloto automático ativado para o lead.');

  const payloadHumano = {
    to: '5533991912291',
    type: 'text',
    text: 'Teste de validação de sistema: Humano (Favor desconsiderar).',
    contact_id: TEST_CONTACT_ID,
    organizacao_id: ORGANIZACAO_ID,
    usuario_id: humanUserId,
    bypass_autopilot: true
  };

  try {
    console.log('Enviando requisição como Humano para /api/whatsapp/send...');
    const response = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadHumano)
    });

    console.log(`Status de resposta da API: ${response.status}`);
    if (!response.ok) {
      console.log('Resposta de erro:', await response.text());
    }

    // Verificar se o piloto automático foi desligado no banco
    const { data: contatoPosHumano } = await supabase
      .from('contatos')
      .select('ia_atendimento_ativo')
      .eq('id', TEST_CONTACT_ID)
      .single();

    console.log(`Status do Piloto Automático pós-envio Humano: ${contatoPosHumano.ia_atendimento_ativo ? 'LIGADO (ERRO!)' : 'DESLIGADO (CORRETO! DESATIVAÇÃO FUNCIONOU!)'}`);

  } catch (err) {
    console.error('Erro ao chamar API no cenário Humano:', err.message);
  }

  // Limpeza final: deixar desativado
  await supabase
    .from('contatos')
    .update({ ia_atendimento_ativo: false })
    .eq('id', TEST_CONTACT_ID);
  
  console.log('\nTeste finalizado.');
}

run().catch(console.error);
