const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const dataCorte = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`Analyzing database starting from ${dataCorte}`);

  // 1. Get messages
  const { data: messages, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, created_at, content, sender_id, receiver_id, contato_id')
    .gte('created_at', dataCorte);

  if (errM) {
    console.error("Error fetching messages:", errM.message);
    return;
  }

  console.log(`Total messages in past 7 days: ${messages.length}`);

  // 2. Count messages by sender/receiver
  let inboundCount = 0;
  let outboundCount = 0;

  // Let's identify users to attribute manual messages
  const { data: users } = await supabase.from('usuarios').select('id, email, contato_id, nome');
  const userMap = {};
  const stellaUserIds = new Set();
  if (users) {
    users.forEach(u => {
      userMap[u.id] = u.nome || u.email;
      if (u.email && u.email.includes('stella')) {
        stellaUserIds.add(u.id);
      }
    });
  }

  let fallbackCount = 0;
  messages.forEach(msg => {
    if (msg.direction === 'inbound') {
      inboundCount++;
    } else {
      outboundCount++;
      if (msg.content && msg.content.includes('oscilação')) {
        fallbackCount++;
      }
    }
  });

  // Let's fetch all cards created or updated in the last 7 days
  const { data: cards, error: errC } = await supabase
    .from('contatos_no_funil')
    .select('id, coluna_id, corretor_id, updated_at, created_at, contato_id')
    .gte('updated_at', dataCorte);

  if (errC) {
    console.error("Error fetching cards:", errC.message);
    return;
  }

  // Fetch corresponding contacts
  const contatoIds = [...new Set(cards.map(c => c.contato_id).filter(Boolean))];
  const { data: contatosData } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo')
    .in('id', contatoIds);
  
  const contatoMap = {};
  if (contatosData) {
    contatosData.forEach(c => {
      contatoMap[c.id] = c;
    });
  }

  const { data: colunas } = await supabase.from('colunas_funil').select('id, nome');
  const colMap = {};
  if (colunas) {
    colunas.forEach(c => {
      colMap[c.id] = c.nome;
    });
  }

  console.log(`\n=== STAGE DISTRIBUTION OF CARDS UPDATED IN THE LAST 7 DAYS (${cards.length} cards) ===`);
  const stageCounts = {};
  const cardsInFails = [];
  const cardsInHumanIntervention = [];

  cards.forEach(card => {
    const colName = colMap[card.coluna_id] || 'Sem Coluna';
    stageCounts[colName] = (stageCounts[colName] || 0) + 1;
    const contato = contatoMap[card.contato_id];
    const leadName = contato?.nome || 'Sem Nome';
    const isStellaActive = contato?.ia_atendimento_ativo ? 'Ativa' : 'Inativa';

    if (colName === 'FALHAS') {
      cardsInFails.push({ id: card.id, name: leadName, updated: card.updated_at, isStellaActive });
    } else if (colName === 'INTERVENÇÃO HUMANA') {
      cardsInHumanIntervention.push({ id: card.id, name: leadName, updated: card.updated_at, isStellaActive });
    }
  });

  console.log(JSON.stringify(stageCounts, null, 2));

  // Count cards by corretor
  const brokerCardCounts = {};
  cards.forEach(card => {
    // Resolve corretor name
    let brokerName = 'Não atribuído';
    if (card.corretor_id) {
      const brokerContact = contatosData?.find(c => c.id === card.corretor_id);
      if (brokerContact) {
        brokerName = brokerContact.nome;
      } else {
        // Fallback checks
        const userObj = users?.find(u => u.contato_id === card.corretor_id);
        if (userObj) {
          brokerName = userObj.nome || userObj.email;
        } else {
          brokerName = `Corretor ID: ${card.corretor_id}`;
        }
      }
    }
    brokerCardCounts[brokerName] = (brokerCardCounts[brokerName] || 0) + 1;
  });

  console.log(`\n=== LEADS CURRENTLY ASSIGNED BY CORRETOR ===`);
  console.log(JSON.stringify(brokerCardCounts, null, 2));

  // Fetch funnel movements in the last 7 days
  const { data: movements, error: errMovs } = await supabase
    .from('historico_movimentacao_funil')
    .select('id, contato_no_funil_id, coluna_anterior_id, coluna_nova_id, usuario_id, data_movimentacao')
    .gte('data_movimentacao', dataCorte);

  if (errMovs) {
    console.error("Error fetching funnel movements:", errMovs.message);
  } else {
    const movesByUser = {};
    movements.forEach(m => {
      let userName = 'Sistema / Stella IA';
      if (m.usuario_id) {
        const userObj = users?.find(u => u.id === m.usuario_id);
        if (userObj) {
          userName = userObj.nome || userObj.email;
        } else {
          userName = `User ID: ${m.usuario_id}`;
        }
      }
      movesByUser[userName] = (movesByUser[userName] || 0) + 1;
    });

    console.log(`\n=== FUNNEL MOVEMENTS PERFORMED IN LAST 7 DAYS BY USER ===`);
    console.log(JSON.stringify(movesByUser, null, 2));
  }

  console.log(`\n=== CARDS IN 'FALHAS' (${cardsInFails.length}) ===`);
  console.log(JSON.stringify(cardsInFails, null, 2));

  console.log(`\n=== CARDS IN 'INTERVENÇÃO HUMANA' (${cardsInHumanIntervention.length}) ===`);
  console.log(JSON.stringify(cardsInHumanIntervention, null, 2));

  console.log(`\n=== GOOGLE/GEMINI CREDITS Depletion / Fallback Count ===`);
  console.log(`Stella sent the technical fallback response ("Notei uma pequena oscilação...") ${fallbackCount} times in the last 7 days.`);
}

main();
