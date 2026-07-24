const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  
  await client.connect();
  
  try {
    // 1. Listar TODOS os empreendimentos
    const resEmp = await client.query(`
      SELECT id, nome, nome_empreendimento, organizacao_id 
      FROM empreendimentos
      ORDER BY id
    `);
    
    let empsText = 'EMPREENDIMENTOS CADASTRADOS:\n';
    resEmp.rows.forEach(r => {
      empsText += `ID: ${r.id} | Nome: "${r.nome}" | Nome Empr: "${r.nome_empreendimento}" | Org: ${r.organizacao_id}\n`;
    });
    console.log(empsText);

    // 2. Buscar todas as atividades da Simone (ID 96)
    const resAct = await client.query(`
      SELECT 
        a.id, 
        a.nome as atividade_nome, 
        a.descricao, 
        a.status as atividade_status, 
        a.data_inicio_prevista, 
        a.data_fim_prevista,
        a.funcionario_id,
        a.empreendimento_id,
        e.nome as empreendimento_nome
      FROM activities a
      LEFT JOIN empreendimentos e ON a.empreendimento_id = e.id
      WHERE a.funcionario_id = 96
      ORDER BY a.data_inicio_prevista ASC, a.id ASC
    `);

    // Separar em Beta Suítes e Elo57 (L57)
    const betaActivities = [];
    const eloActivities = [];
    const outrasActivities = [];

    resAct.rows.forEach(act => {
      const nomeLower = act.atividade_nome.toLowerCase();
      const descLower = (act.descricao || '').toLowerCase();
      const empNomeLower = (act.empreendimento_nome || '').toLowerCase();

      const isBeta = nomeLower.includes('beta') || descLower.includes('beta') || empNomeLower.includes('beta');
      const isElo = nomeLower.includes('elo') || descLower.includes('elo') || empNomeLower.includes('elo') || nomeLower.includes('l57') || descLower.includes('l57');

      if (isBeta) {
        betaActivities.push(act);
      } else if (isElo) {
        eloActivities.push(act);
      } else {
        outrasActivities.push(act);
      }
    });

    const report = {
      empreendimentos: resEmp.rows,
      beta: betaActivities,
      elo: eloActivities,
      outras: outrasActivities
    };

    fs.writeFileSync('scratch/resultados_simone.json', JSON.stringify(report, null, 2), 'utf-8');
    console.log('Dados salvos em scratch/resultados_simone.json');

  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
