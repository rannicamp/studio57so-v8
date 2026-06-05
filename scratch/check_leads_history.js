const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // 1. Leads criados a partir de 2026-05-01 (na Org 2 e que estão no funil)
    const resLeads = await client.query(`
      SELECT 
        cnf.id as cnf_id,
        cnf.contato_id,
        c.nome as lead_nome,
        cnf.coluna_id as coluna_atual_id,
        col.nome as coluna_atual_nome,
        c.created_at
      FROM contatos_no_funil cnf
      INNER JOIN contatos c ON c.id::text = cnf.contato_id::text
      LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
      WHERE cnf.organizacao_id = 2
        AND c.tipo_contato = 'Lead'
        AND c.created_at >= '2026-05-01 00:00:00-03'::timestamptz
      ORDER BY c.created_at DESC;
    `);
    
    console.log(`\n=== Total de Leads no período: ${resLeads.rows.length} ===`);
    
    // 2. Para cada lead, vamos listar a coluna atual e todas as colunas que ele passou no histórico
    const leads = resLeads.rows;
    const formattedIds = leads.map(l => `'${l.cnf_id}'`).join(',');
    
    let resHist = { rows: [] };
    if (leads.length > 0) {
      resHist = await client.query(`
        SELECT 
          h.contato_no_funil_id,
          h.coluna_anterior_id,
          col_ant.nome as coluna_anterior_nome,
          h.coluna_nova_id,
          col_nov.nome as coluna_nova_nome,
          h.data_movimentacao
        FROM historico_movimentacao_funil h
        LEFT JOIN colunas_funil col_ant ON col_ant.id = h.coluna_anterior_id
        LEFT JOIN colunas_funil col_nov ON col_nov.id = h.coluna_nova_id
        WHERE h.contato_no_funil_id IN (${formattedIds})
        ORDER BY h.data_movimentacao ASC;
      `);
    }
    
    console.log(`=== Movimentações encontradas: ${resHist.rows.length} ===`);
    
    // Mapeando movimentações por lead
    const histMap = {};
    resHist.rows.forEach(row => {
      if (!histMap[row.contato_no_funil_id]) {
        histMap[row.contato_no_funil_id] = [];
      }
      histMap[row.contato_no_funil_id].push(row.coluna_nova_nome);
    });
    
    // Exibindo histórico detalhado dos leads
    const summary = leads.map(lead => {
      const passos = histMap[lead.cnf_id] || [];
      return {
        nome: lead.lead_nome,
        criado_em: lead.created_at.toISOString(),
        coluna_atual: lead.coluna_atual_name || lead.coluna_atual_nome,
        passou_por_historico: passos.join(' -> ') || '(Nenhuma movimentação no histórico)'
      };
    });
    
    console.log("\n=== Análise de Caminho por Lead ===");
    console.table(summary.slice(0, 30));
    
    // Verificar se as automações ou o sistema estão inserindo os registros de movimentação
    // Por exemplo, quando o lead é criado, a automação envia a mensagem e move ele para "MENSAGEM ENVIADA"
    // Será que isso gera um registro no histórico?
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
