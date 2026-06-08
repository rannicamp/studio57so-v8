const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    console.log("=== CONECTADO AO BANCO PARA TRIAGEM E SANEAMENTO DO FUNIL ===\n");

    // 1. Verificar se a trigger existe na tabela contatos_no_funil
    const resTriggers = await client.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'contatos_no_funil';
    `);
    const triggersExistentes = resTriggers.rows.map(t => t.trigger_name);
    console.log("Triggers ativas na tabela contatos_no_funil:", triggersExistentes);
    const hasTriggerMovimentacao = triggersExistentes.includes('trg_registrar_movimentacao_funil');
    console.log(`Trigger trg_registrar_movimentacao_funil existe? ${hasTriggerMovimentacao ? 'SIM (Histórico será gerado automaticamente)' : 'NÃO (Teremos que gerar o histórico manualmente)'}\n`);

    // 2. Buscar leads na coluna ENTRADA do Funil de Entrada
    const colunaEntradaOrigem = 'a4e01138-fe34-4fd6-91fb-f40678b1db79'; // ENTRADA (Funil de Entrada)
    const colunaEmAtendimentoDestino = '029c8d6a-4799-4f4b-a55e-b4d5426718c0'; // EM ATENDIMENTO (Funil de Vendas)
    const colunaMensagemEnviadaDestino = '660662df-a1e1-411f-9c2c-0907fce46126'; // MENSAGEM ENVIADA (Funil de Vendas)
    const organizacaoId = 2; // Studio 57

    const resLeads = await client.query(`
      SELECT 
        cnf.id as contato_no_funil_id,
        cnf.contato_id,
        cnf.coluna_id,
        c.nome as lead_nome
      FROM contatos_no_funil cnf
      INNER JOIN contatos c ON c.id = cnf.contato_id
      WHERE cnf.coluna_id = $1 
        AND cnf.organizacao_id = $2
        AND c.tipo_contato = 'Lead';
    `, [colunaEntradaOrigem, organizacaoId]);

    console.log(`Encontrados ${resLeads.rows.length} leads na coluna ENTRADA do Funil de Entrada.\n`);

    if (resLeads.rows.length === 0) {
      console.log("Nenhum lead pendente de triagem.");
      return;
    }

    let totalRespondido = 0;
    let totalNaoRespondido = 0;

    // 3. Processar cada lead
    for (const lead of resLeads.rows) {
      const { contato_no_funil_id, contato_id, lead_nome } = lead;

      // Verificar mensagens inbound do contato
      const resMsgs = await client.query(`
        SELECT count(*) as count_inbound
        FROM public.whatsapp_messages
        WHERE contato_id = $1 
          AND direction = 'inbound'
          AND organizacao_id = $2;
      `, [contato_id, organizacaoId]);

      const countInbound = parseInt(resMsgs.rows[0].count_inbound);
      const respondeu = countInbound > 0;

      const novaColunaId = respondeu ? colunaEmAtendimentoDestino : colunaMensagemEnviadaDestino;
      const nomeNovaColuna = respondeu ? 'EM ATENDIMENTO' : 'MENSAGEM ENVIADA';
      const justificativa = respondeu 
        ? `Lead respondeu à mensagem automática inicial (possui ${countInbound} mensagem(ns) inbound).` 
        : 'Lead não respondeu à mensagem automática inicial no WhatsApp.';

      console.log(`Lead: "${lead_nome}" (ID: ${contato_id}) -> ${respondeu ? 'RESPONDIDO 💬' : 'NÃO RESPONDIDO ⏳'}`);
      console.log(`  - Movendo para: "${nomeNovaColuna}"`);
      console.log(`  - Justificativa: ${justificativa}`);

      // Executar a movimentação de etapa
      await client.query(`
        UPDATE contatos_no_funil
        SET 
          coluna_id = $1,
          updated_at = NOW()
        WHERE id = $2;
      `, [novaColunaId, contato_no_funil_id]);

      // Se não houver a trigger automática no banco, registramos no histórico de movimentação manualmente
      if (!hasTriggerMovimentacao) {
        await client.query(`
          INSERT INTO public.historico_movimentacao_funil (
            contato_no_funil_id,
            coluna_anterior_id,
            coluna_nova_id,
            data_movimentacao,
            organizacao_id
          ) VALUES ($1, $2, $3, NOW(), $4);
        `, [contato_no_funil_id, colunaEntradaOrigem, novaColunaId, organizacaoId]);
      }

      // Inserir nota no CRM registrando a triagem
      await client.query(`
        INSERT INTO public.crm_notas (
          contato_id,
          contato_no_funil_id,
          conteudo,
          organizacao_id
        ) VALUES ($1, $2, $3, $4);
      `, [
        contato_id, 
        contato_no_funil_id, 
        `Triagem Automática Devonildo: Lead movido para a etapa "${nomeNovaColuna}" do Funil de Vendas. Motivo: ${justificativa}`,
        organizacaoId
      ]);

      if (respondeu) {
        totalRespondido++;
      } else {
        totalNaoRespondido++;
      }
      console.log(`  - [OK] Lead movido e nota registrada no CRM.\n`);
    }

    console.log("=================================================");
    console.log("RESUMO DA TRIAGEM DO FUNIL DE ENTRADA:");
    console.log(`- Total de leads processados: ${resLeads.rows.length}`);
    console.log(`- Movidos para "EM ATENDIMENTO" (Responderam): ${totalRespondido}`);
    console.log(`- Movidos para "MENSAGEM ENVIADA" (Não responderam): ${totalNaoRespondido}`);
    console.log("=================================================");

  } catch (err) {
    console.error('Erro fatal durante a triagem:', err);
  } finally {
    await client.end();
  }
}

main();
