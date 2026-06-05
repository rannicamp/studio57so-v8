const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Período de Maio/2026 para a Org 2
    const p_start = '2026-05-01 00:00:00-03';
    const p_end = '2026-05-31 23:59:59-03';
    
    const query = `
      WITH contatos_periodo AS (
        SELECT id, origem, created_at
        FROM contatos
        WHERE organizacao_id = 2
          AND tipo_contato = 'Lead'
          AND created_at >= '${p_start}'::timestamptz
          AND created_at <= '${p_end}'::timestamptz
      ),
      cards_do_periodo AS (
        SELECT cnf.id as contato_no_funil_id, 
               cnf.coluna_id as coluna_atual_id,
               cnf.contato_id,
               col.funil_id,
               col.nome as coluna_nome,
               cnf.corretor_id
        FROM contatos_no_funil cnf
        INNER JOIN contatos_periodo cp ON cp.id::text = cnf.contato_id::text
        LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
        WHERE cnf.organizacao_id = 2
      ),
      -- Leads com mensagens enviadas
      leads_com_mensagem AS (
        SELECT DISTINCT contato_id
        FROM whatsapp_messages
        WHERE organizacao_id = 2
          AND direction = 'outbound'
      ),
      pisadas_brutas AS (
        -- Histórico de movimentações
        SELECT h.contato_no_funil_id, h.coluna_nova_id as coluna_id
        FROM historico_movimentacao_funil h
        INNER JOIN cards_do_periodo cp ON cp.contato_no_funil_id = h.contato_no_funil_id
        UNION
        -- Estado atual
        SELECT cp.contato_no_funil_id, cp.coluna_atual_id as coluna_id
        FROM cards_do_periodo cp
        UNION
        -- Auto-Inserção da Entrada
        SELECT cp.contato_no_funil_id, cf_base.id as coluna_id
        FROM cards_do_periodo cp
        INNER JOIN colunas_funil cf_base ON cf_base.funil_id = cp.funil_id
        WHERE cf_base.ordem = 0 OR UPPER(TRIM(cf_base.nome)) = 'ENTRADA'
        UNION
        -- Injeção Inteligente para "MENSAGEM ENVIADA": Se o lead tem mensagem de WhatsApp outbound,
        -- ele conta como tendo passado pela coluna "MENSAGEM ENVIADA" do funil correspondente.
        SELECT cp.contato_no_funil_id, cf_msg.id as coluna_id
        FROM cards_do_periodo cp
        INNER JOIN colunas_funil cf_msg ON cf_msg.funil_id = cp.funil_id
        INNER JOIN leads_com_mensagem lm ON lm.contato_id::text = cp.contato_id::text
        WHERE UPPER(TRIM(cf_msg.nome)) = 'MENSAGEM ENVIADA'
      ),
      conversao_funil AS (
        SELECT 
          INITCAP(LOWER(TRIM(cf.nome))) as name,
          COUNT(DISTINCT pb.contato_no_funil_id) as value,
          AVG(cf.ordem) as ordem_base
        FROM pisadas_brutas pb
        INNER JOIN colunas_funil cf ON cf.id = pb.coluna_id
        GROUP BY INITCAP(LOWER(TRIM(cf.nome)))
        ORDER BY AVG(cf.ordem) ASC, COUNT(DISTINCT pb.contato_no_funil_id) DESC
      )
      SELECT name, value, ordem_base 
      FROM conversao_funil;
    `;
    
    const res = await client.query(query);
    console.log("=== Resultados do Funil Híbrido (Proposta) ===");
    console.table(res.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
