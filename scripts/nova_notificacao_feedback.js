require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const template = {
    nome_regra: 'Ticket Resolvido',
    tabela_alvo: 'feedback',
    evento: 'UPDATE',
    coluna_monitorada: 'status',
    valor_gatilho: 'Concluído',
    enviar_para_dono: true,
    titulo_template: 'Seu Ticket foi Resolvido! ✅',
    mensagem_template: 'O ticket #{id} ({problema}) foi marcado como Concluído.',
    link_template: '/admin/feedbacks',
    icone: 'fa-check-circle',
    organizacao_id: 1
  };

  const { data, error } = await supabase
    .from('sys_notification_templates')
    .insert(template)
    .select();

  if (error) {
     console.log('Insert error/Exists, updating...', error.message);
     const { error: updErr } = await supabase
        .from('sys_notification_templates')
        .update(template)
        .eq('tabela_alvo', 'feedback')
        .eq('valor_gatilho', 'Concluído');
     if(updErr) console.error(updErr);
     else console.log('Template atualizado com sucesso.');
  } else {
     console.log('Template inserido com sucesso:', data[0].id);
  }
}
main();
