// scratch/executar_correcoes_varredura.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rota local para disparar os webhooks de WhatsApp
const LOCAL_API_URL = 'http://localhost:3000/api/whatsapp/send';

async function main() {
  console.log("=== INICIANDO EXECUÇÃO DAS CORREÇÕES DE VARREDURA ===");

  try {
    const fetch = (await import('node-fetch')).default;

    // 1. Buscar os templates e dados de configuração da Org 2
    const { data: whatsappConfig, error: errWConfig } = await supabase
      .from('configuracoes_whatsapp')
      .select('*')
      .eq('organizacao_id', 2)
      .limit(1)
      .maybeSingle();

    if (errWConfig || !whatsappConfig) {
      console.error("Erro ao carregar configuração de WhatsApp da Org 2:", errWConfig || "Configuração vazia");
      return;
    }

    // Buscar o ID da Stella na public.usuarios
    const { data: stellaUserRecord } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', `stella.org2@elo57.com.br`)
      .maybeSingle();

    const stellaUserId = stellaUserRecord?.id || null;

    // 2. Mapear as colunas de funil da Org 2 dinamicamente
    const { data: funis } = await supabase.from('funis').select('id').eq('organizacao_id', 2);
    const funilIds = (funis || []).map(f => f.id);

    if (funilIds.length === 0) {
      console.error("Nenhum funil encontrado para a organização 2.");
      return;
    }

    const { data: colunas, error: errColunas } = await supabase
      .from('colunas_funil')
      .select('id, nome, tipo_coluna')
      .in('funil_id', funilIds);

    if (errColunas) {
      console.error("Erro ao buscar colunas de funil:", errColunas.message);
      return;
    }

    console.log("Colunas encontradas no funil da Org 2:");
    colunas.forEach(c => console.log(` - [${c.id}] ${c.nome} (tipo: ${c.tipo_coluna})`));

    // Achar colunas por aproximação de nome/tipo
    const colMsgEnviada = colunas.find(c => c.nome.toUpperCase().includes('MENSAGEM ENVIADA')) || colunas[0];
    const colEmAtendimento = colunas.find(c => c.nome.toUpperCase().includes('EM ATENDIMENTO')) || colunas[0];
    const colPerdido = colunas.find(c => c.nome.toUpperCase().includes('PERDIDO')) || colunas.find(c => c.tipo_coluna === 'perdido') || colunas[colunas.length - 1];
    const colIntervencao = colunas.find(c => c.nome.toUpperCase().includes('INTERVENÇÃO HUMANA') || c.nome.toUpperCase().includes('HUMANA') || c.nome.toUpperCase().includes('QUALIFICAÇÃO STELLA')) || colunas[0];

    console.log(`\nMapeamento de colunas para correções:`);
    console.log(` - MENSAGEM ENVIADA: [${colMsgEnviada.id}] ${colMsgEnviada.nome}`);
    console.log(` - EM ATENDIMENTO: [${colEmAtendimento.id}] ${colEmAtendimento.nome}`);
    console.log(` - PERDIDO: [${colPerdido.id}] ${colPerdido.nome}`);
    console.log(` - INTERVENÇÃO HUMANA: [${colIntervencao.id}] ${colIntervencao.nome}`);

    // Função auxiliar para mover o contato de coluna no CRM e gravar nota
    async function moverEGravarNota(contatoId, colunaDestinoId, justificativa) {
      console.log(`[CRM] Movendo lead ID ${contatoId} para coluna ${colunaDestinoId}...`);
      
      // 1. Atualizar ou inserir na contatos_no_funil
      const { data: funilRecord } = await supabase
        .from('contatos_no_funil')
        .select('id')
        .eq('contato_id', contatoId)
        .maybeSingle();

      let funilId = null;
      if (funilRecord) {
        funilId = funilRecord.id;
        await supabase
          .from('contatos_no_funil')
          .update({ coluna_id: colunaDestinoId })
          .eq('id', funilId);
      } else {
        const { data: newFunil } = await supabase
          .from('contatos_no_funil')
          .insert({
            contato_id: contatoId,
            coluna_id: colunaDestinoId,
            organizacao_id: 2
          })
          .select('id')
          .single();
        funilId = newFunil?.id;
      }

      // 2. Gravar nota de CRM
      if (funilId) {
        await supabase.from('crm_notas').insert({
          contato_id: contatoId,
          contato_no_funil_id: funilId,
          conteudo: justificativa,
          usuario_id: stellaUserId,
          organizacao_id: 2
        });
        console.log(`[CRM] Nota gravada para o lead ID ${contatoId}.`);
      }
    }

    // =========================================================================
    // EXECUÇÃO DAS AÇÕES CORRETIVAS
    // =========================================================================

    // 1. Will (ID: 3467) -> Reativar
    console.log("\n--- [CORREÇÃO] Will (ID: 3467) ---");
    const { data: phoneWill } = await supabase.from('telefones').select('telefone').eq('contato_id', 3467).maybeSingle();
    const telWill = phoneWill?.telefone || '15084319236';

    // Ativar piloto e mover para EM ATENDIMENTO
    await supabase.from('contatos').update({ ia_atendimento_ativo: true }).eq('id', 3467);
    await moverEGravarNota(3467, colEmAtendimento.id, "Piloto automático ativado e conversa reengajada com o template 'eua_retomar_conversa' via auditoria de rotina.");

    // Disparar template eua_retomar_conversa
    console.log(`[API] Disparando template eua_retomar_conversa para ${telWill}...`);
    try {
      const resWill = await fetch(LOCAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: telWill,
          type: 'template',
          templateName: 'eua_retomar_conversa',
          components: [],
          custom_content: "Estou passando para verificar se você conseguiu acessar as informações que enviamos anteriormente. Deu tudo certo?",
          contact_id: 3467,
          organizacao_id: 2,
          usuario_id: stellaUserId
        })
      });
      if (resWill.ok) {
        console.log("Template enviado para Will com sucesso.");
      } else {
        console.error("Falha ao enviar template para Will:", await resWill.text());
      }
    } catch (fetchErr) {
      console.error("Erro na requisição para Will:", fetchErr.message);
    }

    // 2. Sueli Santos (ID: 6059) -> Saudação Fria
    console.log("\n--- [CORREÇÃO] Sueli Santos (ID: 6059) ---");
    const { data: phoneSueli } = await supabase.from('telefones').select('telefone').eq('contato_id', 6059).maybeSingle();
    const telSueli = phoneSueli?.telefone || '5533999317303';

    // Ativar piloto e mover para MENSAGEM ENVIADA
    await supabase.from('contatos').update({ ia_atendimento_ativo: true }).eq('id', 6059);
    await moverEGravarNota(6059, colMsgEnviada.id, "Piloto automático ativado e primeiro contato estabelecido com o template 'saudacao_entrada_v3' via auditoria de rotina.");

    // Disparar template saudacao_entrada_v3
    console.log(`[API] Disparando template saudacao_entrada_v3 para ${telSueli}...`);
    try {
      const resSueli = await fetch(LOCAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: telSueli,
          type: 'template',
          templateName: 'saudacao_entrada_v3',
          components: [],
          custom_content: "Oi! Tudo bem? Recebemos o seu interesse em nossos empreendimentos. Podemos liberar e te enviar os materiais completos por aqui?",
          contact_id: 6059,
          organizacao_id: 2,
          usuario_id: stellaUserId
        })
      });
      if (resSueli.ok) {
        console.log("Template enviado para Sueli Santos com sucesso.");
      } else {
        console.error("Falha ao enviar template para Sueli:", await resSueli.text());
      }
    } catch (fetchErr) {
      console.error("Erro na requisição para Sueli:", fetchErr.message);
    }

    // 3. Vilma Marulanda (ID: 6073) -> Mover para Intervenção Humana (limite/qualidade da Meta)
    console.log("\n--- [CORREÇÃO] Vilma Marulanda (ID: 6073) ---");
    await supabase.from('contatos').update({ ia_atendimento_ativo: false }).eq('id', 6073);
    await moverEGravarNota(6073, colIntervencao.id, "Piloto automático desativado. A Meta recusou o template inicial com erro 131049 (limite de qualidade/spam). Fazer contato manual por outro número ou ligação.");

    // 4. Lead Linda Inox (ID: 4919) -> Mover para Perdido (Spam/Fornecedor)
    console.log("\n--- [CORREÇÃO] Linda Inox (ID: 4919) ---");
    await supabase.from('contatos').update({ ia_atendimento_ativo: false }).eq('id', 4919);
    await moverEGravarNota(4919, colPerdido.id, "Lead marcado como Perdido (Spam de fornecedor comercial de cubas de inox - Linda Inox).");

    // 5. Cicero Alves (ID: 5020), Renilda Carneiro (ID: 6077), Márcio Fernandes (ID: 6087) -> Perdido (Telefone Inválido)
    const leadsInvalidos = [
      { id: 5020, nome: "Cicero Nascimento Alves" },
      { id: 6077, nome: "Renilda carneiro" },
      { id: 6087, nome: "Márcio Fernandes" }
    ];

    for (const lead of leadsInvalidos) {
      console.log(`\n--- [CORREÇÃO] ${lead.nome} (ID: ${lead.id}) ---`);
      await supabase.from('contatos').update({ ia_atendimento_ativo: false }).eq('id', lead.id);
      await moverEGravarNota(lead.id, colPerdido.id, "Lead marcado como Perdido. A tentativa de envio falhou definitivamente com erro 131026 (Destinatário inválido ou sem WhatsApp).");
    }

    console.log("\n=== CORREÇÕES EXECUTADAS COM SUCESSO! ===");

  } catch (err) {
    console.error("Erro crítico na execução das correções:", err.message);
  }
}

main();
