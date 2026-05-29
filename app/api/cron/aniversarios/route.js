import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
  console.log("--- [CRON] Verificando Aniversariantes do Dia ---");

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Configuração de chaves do Supabase inválida" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Obter a data atual do fuso horário brasileiro (GMT-3)
  const options = { timeZone: 'America/Sao_Paulo', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('pt-BR', options);
  const [{ value: day }, , { value: month }] = formatter.formatToParts(new Date());
  const dayMonthStr = `${month}-${day}`; // formato MM-DD (ex: '05-29')
  
  console.log(`[CRON] Buscando aniversariantes de hoje (${dayMonthStr}) no fuso America/Sao_Paulo`);

  try {
    // 2. Buscar funcionários ativos que tenham data de nascimento
    const { data: employees, error: errEmp } = await supabaseAdmin
      .from('funcionarios')
      .select('id, full_name, birth_date, organizacao_id')
      .eq('status', 'Ativo')
      .not('birth_date', 'is', null);

    if (errEmp) throw errEmp;

    // 3. Buscar contatos ativos que sejam clientes e tenham data de nascimento
    const { data: clients, error: errClients } = await supabaseAdmin
      .from('contatos')
      .select('id, nome, birth_date, organizacao_id, tipo_contato')
      .eq('status', 'Ativo')
      .eq('tipo_contato', 'Cliente')
      .not('birth_date', 'is', null);

    if (errClients) throw errClients;

    const checkBirthday = (birthDateStr) => {
      if (!birthDateStr) return false;
      const parts = birthDateStr.split('-');
      if (parts.length < 3) return false;
      return `${parts[1]}-${parts[2]}` === dayMonthStr;
    };

    const birthdayEmployees = employees?.filter(e => checkBirthday(e.birth_date)) || [];
    const birthdayClients = clients?.filter(c => checkBirthday(c.birth_date)) || [];

    console.log(`[CRON] Encontrados ${birthdayEmployees.length} funcionários e ${birthdayClients.length} clientes aniversariantes hoje.`);

    const postsCreated = [];

    // 4. Processar Funcionários
    for (const emp of birthdayEmployees) {
      const orgId = emp.organizacao_id;
      const nomeCompleto = emp.full_name.trim();

      // Buscar primeiro usuário administrador da organização para ser o autor
      const { data: users } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: true })
        .limit(1);

      const authorId = users?.[0]?.id;
      if (!authorId) {
        console.warn(`[CRON] Nenhum usuário encontrado para a organizacao_id ${orgId}. Pulando funcionário ${nomeCompleto}.`);
        continue;
      }

      const assunto = `🎉 Feliz Aniversário, ${nomeCompleto}! 🎂`;
      
      // Proteção de duplicidade: verificar se já existe post hoje com o mesmo assunto
      const { data: existingPost } = await supabaseAdmin
        .from('sys_chat_mural_posts')
        .select('id')
        .eq('organizacao_id', orgId)
        .eq('assunto', assunto)
        .gte('created_at', new Date().toISOString().split('T')[0])
        .limit(1);

      if (existingPost && existingPost.length > 0) {
        console.log(`[CRON] Post de aniversário para o funcionário "${nomeCompleto}" já existe hoje. Pulando.`);
        continue;
      }

      const conteudo = `Hoje é um dia de muita alegria e festa para todos nós! 🥳🎈\n\nToda a equipe do Studio 57 deseja um feliz aniversário para o(a) nosso(a) querido(a) colaborador(a) ${nomeCompleto}! \n\nParabéns por mais um ano de vida, saúde, paz e conquistas. É uma honra ter você caminhando e crescendo junto conosco! Que o seu dia seja repleto de sorrisos e abraços apertados. Parabéns! 🎂✨🎉`;

      const { error: insertErr } = await supabaseAdmin
        .from('sys_chat_mural_posts')
        .insert({
          organizacao_id: orgId,
          author_id: authorId,
          assunto,
          conteudo
        });

      if (insertErr) {
        console.error(`[CRON] Erro ao criar post para funcionário ${nomeCompleto}:`, insertErr);
      } else {
        console.log(`[CRON] Post criado para o funcionário "${nomeCompleto}" na organização ${orgId}`);
        postsCreated.push({ nome: nomeCompleto, tipo: 'funcionario', orgId });
      }
    }

    // 5. Processar Clientes
    for (const client of birthdayClients) {
      const orgId = client.organizacao_id;
      const nomeCompleto = client.nome.trim();

      const { data: users } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: true })
        .limit(1);

      const authorId = users?.[0]?.id;
      if (!authorId) {
        console.warn(`[CRON] Nenhum usuário encontrado para a organizacao_id ${orgId}. Pulando cliente ${nomeCompleto}.`);
        continue;
      }

      const assunto = `🎉 Feliz Aniversário, ${nomeCompleto}! 🎂`;

      const { data: existingPost } = await supabaseAdmin
        .from('sys_chat_mural_posts')
        .select('id')
        .eq('organizacao_id', orgId)
        .eq('assunto', assunto)
        .gte('created_at', new Date().toISOString().split('T')[0])
        .limit(1);

      if (existingPost && existingPost.length > 0) {
        console.log(`[CRON] Post de aniversário para o cliente "${nomeCompleto}" já existe hoje. Pulando.`);
        continue;
      }

      const conteudo = `Hoje celebramos a vida de uma pessoa super especial para todos nós! 🎂🎁\n\nDesejamos um feliz aniversário para o(a) nosso(a) cliente especial ${nomeCompleto}! \n\nQue este novo ciclo traga muita saúde, prosperidade, paz e a realização de grandes sonhos. É um imenso orgulho ter você como parte do nosso caminho e da nossa família Studio 57. Parabéns pelo seu dia! ✨🎉🥳`;

      const { error: insertErr } = await supabaseAdmin
        .from('sys_chat_mural_posts')
        .insert({
          organizacao_id: orgId,
          author_id: authorId,
          assunto,
          conteudo
        });

      if (insertErr) {
        console.error(`[CRON] Erro ao criar post para cliente ${nomeCompleto}:`, insertErr);
      } else {
        console.log(`[CRON] Post criado para o cliente "${nomeCompleto}" na organização ${orgId}`);
        postsCreated.push({ nome: nomeCompleto, tipo: 'cliente', orgId });
      }
    }

    return NextResponse.json({
      success: true,
      processedDate: dayMonthStr,
      aniversariantesHoje: {
        funcionarios: birthdayEmployees.length,
        clientes: birthdayClients.length
      },
      postsCriados: postsCreated
    });

  } catch (error) {
    console.error("[CRON ERROR] Falha no cron de aniversários:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
