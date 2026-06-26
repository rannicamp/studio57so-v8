// scratch/testar_busca_stella_send.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const organizacao_id = 2;
  const requestUserId = '1c69bf44-6bcc-4fce-8702-f2fd4c7f114d'; // ID da Stella Org 2
  const contatoIaAtivo = true;
  const finalContactId = 5976; // Sarah

  console.log("=== SIMULANDO BUSCA DE STELLA NA ROTA SEND/ROUTE.JS ===");

  let stellaUserId = null;
  try {
    const { data: stellaUser } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', `stella.org${organizacao_id}@elo57.com.br`)
      .maybeSingle();
      
    if (stellaUser) {
      stellaUserId = stellaUser.id;
    }
  } catch (stellaErr) {
    console.error('[WhatsApp Send Warning] Erro ao buscar usuário da Stella:', stellaErr.message);
  }

  const isHumanSending = requestUserId && requestUserId !== stellaUserId;

  console.log(`stellaUserId recuperado: "${stellaUserId}"`);
  console.log(`requestUserId enviado:    "${requestUserId}"`);
  console.log(`isHumanSending:           ${isHumanSending}`);

  if (isHumanSending && contatoIaAtivo && finalContactId) {
    console.log(`[ALERTA] DESATIVARIA O PILOTO AUTOMÁTICO!`);
  } else {
    console.log(`[OK] Piloto automático seria mantido ativo.`);
  }
}

main();
