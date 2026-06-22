import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateContentWithTelemetry } from '../../../../utils/gemini';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tokenHeader = request.headers.get('Authorization') || searchParams.get('token');
  const expectedToken = process.env.CRON_SECRET || 'Srbr19010720@';

  if (tokenHeader !== expectedToken) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const organizacaoId = 2; // Studio 57
  const colunaMensagemEnviadaId = '660662df-a1e1-411f-9c2c-0907fce46126'; // MENSAGEM ENVIADA
  const limiteDias = 7; // leads parados há mais de 7 dias

  console.log(`[Reactivator Cron] Varrendo leads para reativação automática da Stella na Org ${organizacaoId}...`);

  try {
    // Buscar o ID de usuário da Stella IA desta organização
    const { data: stellaUser } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', `stella.org${organizacaoId}@elo57.com.br`)
      .maybeSingle();
    const stellaUserId = stellaUser?.id;

    // 1. Obter a data limite (7 dias atrás)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - limiteDias);

    // 2. Buscar leads na coluna MENSAGEM ENVIADA atualizados há mais de 7 dias (incluindo ia_atendimento_ativo)
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('contatos_no_funil')
      .select(`
        id,
        contato_id,
        updated_at,
        contatos(id, nome, ia_atendimento_ativo, telegram_chat_id, telefone:telefones(telefone))
      `)
      .eq('organizacao_id', organizacaoId)
      .eq('coluna_id', colunaMensagemEnviadaId)
      .lt('updated_at', dataLimite.toISOString());

    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: 'Nenhum lead elegível para reativação encontrado.' });
    }

    console.log(`[Reactivator Cron] Encontrados ${leads.length} leads parados na coluna de Mensagem Enviada.`);

    const reativados = [];

    // 3. Processar cada lead individualmente
    for (const lead of leads) {
      const contatoId = lead.contato_id;
      const nomeCliente = lead.contatos?.nome || 'Cliente';

      // 3.5. Verificar se piloto automático está ativo para o contato
      if (!lead.contatos?.ia_atendimento_ativo) {
        console.log(`[Reactivator Cron] Piloto automático desativado para ${nomeCliente} (Contato ID: ${contatoId}). Pulando reativação.`);
        continue;
      }

      // 4. Verificar se há alguma mensagem inbound no histórico do WhatsApp
      const { data: msgs, error: msgsError } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('direction')
        .eq('contato_id', contatoId)
        .eq('direction', 'inbound')
        .limit(1);

      if (msgsError) {
        console.error(`[Reactivator Cron] Erro ao buscar mensagens para o contato ${contatoId}:`, msgsError);
        continue;
      }

      if (msgs && msgs.length > 0) {
        continue;
      }

      const telefones = lead.contatos?.telefone || [];
      const numTelefone = telefones[0]?.telefone;

      if (!numTelefone) {
        console.warn(`[Reactivator Cron] Lead ${nomeCliente} (ID ${contatoId}) não possui telefone cadastrado. Pulando.`);
        continue;
      }

      console.log(`[Reactivator Cron] Reativando lead elegível: ${nomeCliente} (Telefone: ${numTelefone})`);

      // 5. Chamar o Gemini para gerar uma mensagem curta e simpática de reativação
      const promptReativacao = `
Você é a Stella, a assistente comercial super amigável do Studio 57.
Sua missão é enviar um lembrete curto no WhatsApp para o cliente ${nomeCliente} que se cadastrou há mais de uma semana mas nunca respondeu ao nosso primeiro contato.

Crie uma mensagem de reativação extremamente curta (máximo 2 a 3 linhas), informal, leve e simpática.
Exemplos:
- "Oi, ${nomeCliente}! Tudo bem? Passando para saber se você conseguiu dar uma olhadinha nos materiais que te mandei semana passada ou se gostaria de ver chácaras de lazer ou apartamentos."
- "Olá, ${nomeCliente}! Só passando para contar que liberamos chácaras com ótimas condições de pré-lançamento no Refúgio Braúnas. Ainda faz sentido a busca por imóvel para você?"

Gere apenas o texto final da mensagem de WhatsApp, sem explicações ou formatações markdown de código.
`;

      let mensagemReativacao = '';
      try {
        const result = await generateContentWithTelemetry({
          modelName: 'gemini-2.5-flash',
          promptContent: [{ text: promptReativacao }],
          origem: 'cron-reactivate-leads',
          context: 'Reativação de Leads',
          contatoId: contatoId,
          organizacaoId: organizacaoId
        });
        mensagemReativacao = result.response.text().trim();
      } catch (geminiErr) {
        console.error('[Reactivator Cron] Erro ao gerar texto no Gemini:', geminiErr);
        mensagemReativacao = `Oi, ${nomeCliente}! Tudo bem? Passando para saber se você conseguiu ver os materiais que te enviei ou se ainda está buscando um imóvel.`;
      }

      // 6. Enviar a mensagem via API interna de envio de WhatsApp do projeto
      try {
        const sendResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/whatsapp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: numTelefone,
            type: 'text',
            text: mensagemReativacao,
            contact_id: contatoId,
            organizacao_id: organizacaoId,
            usuario_id: stellaUserId
          })
        });

        const sendResult = await sendResponse.json();

        if (!sendResponse.ok) {
          throw new Error(sendResult.error || 'Erro na API de envio');
        }

        console.log(`[Reactivator Cron] Mensagem de reativação enviada com sucesso para ${nomeCliente}.`);

        // 7. Atualizar a data de atualização do lead no funil para não reativar novamente na próxima rodada imediata
        await supabaseAdmin
          .from('contatos_no_funil')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', lead.id);

        // 8. Inserir nota no CRM registrando a ação
        await supabaseAdmin
          .from('crm_notas')
          .insert({
            contato_id: contatoId,
            contato_no_funil_id: lead.id,
            conteudo: `Piloto Automático Stella: Enviada mensagem automática de reativação para o lead que não respondia há mais de 7 dias. Conteúdo da mensagem: "${mensagemReativacao}"`,
            organizacao_id: organizacaoId
          });

        reativados.push({ contato_id: contatoId, nome: nomeCliente });

      } catch (sendErr) {
        console.error(`[Reactivator Cron] Falha ao enviar mensagem de reativação para ${nomeCliente}:`, sendErr.message);
      }
    }

    return NextResponse.json({
      message: `Cron executado com sucesso. ${reativados.length} leads reativados.`,
      reativados: reativados
    });

  } catch (err) {
    console.error('[Reactivator Cron Fatal Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
