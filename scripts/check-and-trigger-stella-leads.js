const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Carrega variáveis do .env.local de forma dinâmica
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('URL ou Key do Supabase não configurados.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('=== Iniciando busca de leads sob responsabilidade da Stella ===');

  // 1. Buscar todos os usuários Stella
  const { data: stellaUsers, error: usersErr } = await supabase
    .from('usuarios')
    .select('id, contato_id, email, organizacao_id')
    .like('email', 'stella.org%');

  if (usersErr) {
    console.error('Erro ao buscar usuários Stella:', usersErr.message);
    return;
  }

  console.log(`Encontrados ${stellaUsers.length} robôs Stella.`);

  for (const stella of stellaUsers) {
    console.log(`\n> Analisando Stella para a Organização ${stella.organizacao_id} (${stella.email})`);

    if (!stella.contato_id) {
      console.warn(`Stella ${stella.email} não possui contato_id associado. Ignorando.`);
      continue;
    }

    // 2. Buscar contatos_no_funil onde a Stella é a corretora
    const { data: funilCards, error: funilErr } = await supabase
      .from('contatos_no_funil')
      .select('id, contato_id, coluna_id, corretor_id')
      .eq('corretor_id', stella.contato_id);

    if (funilErr) {
      console.error(`Erro ao buscar leads no funil:`, funilErr.message);
      continue;
    }

    console.log(`Stella tem ${funilCards.length} leads atribuídos no funil.`);

    for (const card of funilCards) {
      // 3. Buscar detalhes do contato
      const { data: contato, error: contatoErr } = await supabase
        .from('contatos')
        .select('id, nome, ia_atendimento_ativo, organizacao_id')
        .eq('id', card.contato_id)
        .single();

      if (contatoErr || !contato) {
        console.error(`Erro ao buscar contato ${card.contato_id}:`, contatoErr?.message);
        continue;
      }

      // 4. Buscar última mensagem da conversa
      const { data: ultimaMsg, error: msgErr } = await supabase
        .from('whatsapp_messages')
        .select('id, content, direction, created_at')
        .eq('contato_id', contato.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (msgErr) {
        console.error(`Erro ao buscar última mensagem do contato ${contato.nome}:`, msgErr.message);
        continue;
      }

      console.log(`Lead: ${contato.nome} (ID: ${contato.id})`);
      console.log(` - Piloto ativo: ${contato.ia_atendimento_ativo}`);
      if (ultimaMsg) {
        console.log(` - Última mensagem (${ultimaMsg.direction}) [${new Date(ultimaMsg.created_at).toLocaleString('pt-BR')}]: "${ultimaMsg.content}"`);
      } else {
        console.log(` - Sem histórico de mensagens.`);
      }

      // Se a última mensagem for inbound (mensagem do cliente pendente de resposta)
      if (ultimaMsg && ultimaMsg.direction === 'inbound') {
        console.log(` -> Lead com mensagem inbound pendente!`);

        // Se o piloto automático não estiver ativo, ativamos ele no banco!
        if (!contato.ia_atendimento_ativo) {
          console.log(` -> Ativando ia_atendimento_ativo para ${contato.nome}...`);
          const { error: updateErr } = await supabase
            .from('contatos')
            .update({ ia_atendimento_ativo: true })
            .eq('id', contato.id);
          
          if (updateErr) {
            console.error(`Erro ao ativar piloto automático:`, updateErr.message);
            continue;
          }
        }

        // Chamar o trigger-autopilot na produção ou ambiente desejado
        const domain = process.env.NEXTAUTH_URL || 'https://studio57.arq.br/';
        const triggerUrl = `${domain}api/whatsapp/trigger-autopilot`;

        console.log(` -> Disparando trigger-autopilot: ${triggerUrl}`);
        
        try {
          const res = await fetch(triggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contato_id: contato.id,
              organizacao_id: contato.organizacao_id
            })
          });
          const resJson = await res.json();
          console.log(` -> Resposta do trigger:`, resJson);
        } catch (fetchErr) {
          console.error(` -> Erro ao chamar o trigger-autopilot:`, fetchErr.message);
        }
      } else {
        console.log(` -> Ignorado.`);
      }
    }
  }
}

run();
