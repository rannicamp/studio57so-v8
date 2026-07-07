// scratch/executar_correcao_diagnostico.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurações
const COLUNA_ENTRADA_ATIVA = '902f7707-1f11-4fa6-89c3-b15735acfe1d'; // Entrada global (99 leads)
const COLUNA_MSG_ENVIADA_ORG2 = '660662df-a1e1-411f-9c2c-0907fce46126'; // Mensagem Enviada da Org 2
const AUTOMACAO_ID = '9455ccdf-500b-4a57-b08e-3243954e3d74'; // Automação "Boas-vindas Funil de Vendas"

async function main() {
  console.log("=== INICIANDO APLICAÇÃO DE CORREÇÕES ===");

  try {
    // 1. Obter o funil_id correto para a coluna de Entrada ativa
    const { data: colunaAtiva, error: errCol } = await supabase
      .from('colunas_funil')
      .select('funil_id')
      .eq('id', COLUNA_ENTRADA_ATIVA)
      .single();

    if (errCol || !colunaAtiva) {
      console.error("Erro ao obter dados da coluna de entrada ativa:", errCol?.message);
      return;
    }

    const funilIdCorreto = colunaAtiva.funil_id;
    console.log(`Coluna ativa pertence ao Funil ID: ${funilIdCorreto}`);

    // 2. Corrigir a automação no banco de dados
    const gatilhoConfigCorreto = {
      funil_id: funilIdCorreto,
      coluna_id: COLUNA_ENTRADA_ATIVA,
      condicoes: {
        tipo: "Lead"
      }
    };

    console.log("\n1. Atualizando automação de boas-vindas...");
    const { error: errAut } = await supabase
      .from('automacoes')
      .update({
        gatilho_config: gatilhoConfigCorreto,
        updated_at: new Date().toISOString()
      })
      .eq('id', AUTOMACAO_ID);

    if (errAut) {
      console.error("Erro ao atualizar automação:", errAut.message);
    } else {
      console.log("🟢 Automação de Boas-vindas atualizada com sucesso para escutar a coluna Entrada correta!");
    }

    // 3. Mover os 20 leads respondidos com sucesso para "MENSAGEM ENVIADA"
    console.log("\n2. Identificando e movendo leads já respondidos para a coluna correta...");
    
    // Ler o arquivo JSON de diagnóstico para obter a lista de respondidos
    const path = require('path');
    const diagnosticoPath = path.join(__dirname, 'diagnostico_entrada_geral.json');
    if (!require('fs').existsSync(diagnosticoPath)) {
      console.error("Arquivo diagnostico_entrada_geral.json não encontrado. Rode o script de diagnóstico antes.");
      return;
    }

    const analise = require(diagnosticoPath);
    const respondidos = analise.filter(a => a.situacao.includes("Respondido com sucesso"));

    console.log(`Encontrados ${respondidos.length} leads já respondidos na Entrada.`);

    let countMovidos = 0;
    for (const lead of respondidos) {
      console.log(`Movendo: ${lead.nome} (Card ID: ${lead.card_id}) para MENSAGEM ENVIADA...`);
      
      const { error: errMov } = await supabase
        .from('contatos_no_funil')
        .update({
          coluna_id: COLUNA_MSG_ENVIADA_ORG2,
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.card_id);

      if (errMov) {
        console.error(`❌ Erro ao mover ${lead.nome}:`, errMov.message);
      } else {
        countMovidos++;
        // Registrar nota no CRM
        await supabase.from('crm_notas').insert({
          contato_id: lead.contato_id,
          contato_no_funil_id: lead.card_id,
          conteudo: `🤖 [Varredura de Diagnóstico] Lead movido retroativamente para a etapa "MENSAGEM ENVIADA" porque já possuía conversas ativas com mensagens entregues.`,
          organizacao_id: lead.organizacao_id || 2
        });
      }
    }

    console.log(`\n🟢 Varredura de movimentação concluída! ${countMovidos} de ${respondidos.length} leads movidos com sucesso.`);

  } catch (err) {
    console.error("Erro geral na execução:", err);
  }
}

main();
