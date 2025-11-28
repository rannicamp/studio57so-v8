import { createClient } from '@/utils/supabase/server';

/**
 * 📨 CARTEIRO DO STUDIO 57
 * Função padrão para gerar notificações internas no sistema.
 * Use isso em Server Actions (arquivos actions.js) ou rotas de API.
 * * @param {Object} params
 * @param {string} params.userId - ID do usuário que vai receber o aviso (Obrigatório)
 * @param {string} params.titulo - Título curto (ex: "Novo Cliente")
 * @param {string} params.mensagem - Detalhes (ex: "João Silva foi cadastrado")
 * @param {string} [params.link] - Link para onde vai ao clicar (opcional)
 * @param {string} [params.organizacaoId] - Para manter os dados organizados (opcional)
 */
export async function enviarNotificacao({ userId, titulo, mensagem, link = null, organizacaoId = null }) {
  try {
    const supabase = await createClient();

    // Monta o pacote para o banco
    const dadosNotificacao = {
      user_id: userId,
      titulo: titulo,
      mensagem: mensagem,
      link: link,
      lida: false, // Nasce como não lida
      created_at: new Date().toISOString() // Garante a data certa
    };

    // Se tiver ID da organização, adiciona (bom para relatórios futuros)
    if (organizacaoId) {
        dadosNotificacao.organizacao_id = organizacaoId;
    }

    const { error } = await supabase
      .from('notificacoes')
      .insert(dadosNotificacao);

    if (error) {
      console.error("❌ Erro ao criar notificação:", error.message);
      return { sucesso: false, erro: error.message };
    }

    console.log(`✅ Notificação criada para ${userId}: ${titulo}`);
    return { sucesso: true };

  } catch (error) {
    console.error("🚨 Erro fatal no carteiro:", error);
    return { sucesso: false, erro: error.message };
  }
}