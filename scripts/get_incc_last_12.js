const { Client } = require('pg');

async function run() {
  const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase');

    // Puxa as referências de INCC até junho de 2026 (ou anteriores) ordenando por data decrescente limitando a 12
    const res = await client.query(`
      SELECT nome_indice, mes_ano, data_referencia, valor_mensal 
      FROM public.indices_governamentais 
      WHERE nome_indice = 'INCC' 
        AND data_referencia <= '2026-06-30'
      ORDER BY data_referencia DESC
      LIMIT 12;
    `);

    const rows = res.rows;
    console.log(`\n📋 Últimas ${rows.length} referências de INCC até Junho/2026 encontradas no Banco:`);
    console.table(rows.map(r => ({
      'Mês/Ano': r.mes_ano,
      'Data Referência': r.data_referencia.toISOString().split('T')[0],
      'Valor Mensal (%)': parseFloat(r.valor_mensal)
    })));

    // Cálculo composto (multiplicativo)
    let acumulado = 1.0;
    for (const r of rows) {
      const v = parseFloat(r.valor_mensal);
      acumulado *= (1 + (v / 100));
    }
    const totalAcumuladoComposto = (acumulado - 1) * 100;

    // Cálculo simples (soma para comparação)
    const totalSimples = rows.reduce((acc, r) => acc + parseFloat(r.valor_mensal), 0);

    console.log('\n📐 Cálculos de Acumulação dos 12 meses:');
    console.log(`- Acumulado Composto (Juros Compostos - Oficial): ${totalAcumuladoComposto.toFixed(4)}%`);
    console.log(`- Soma Simples (Juros Simples - Apenas ref): ${totalSimples.toFixed(4)}%`);

    // Testar também a fórmula SQL correspondente diretamente no banco para provar que a trigger calcula o mesmo
    const resSql = await client.query(`
      SELECT ROUND(((exp(sum(ln(GREATEST(1 + valor_mensal / 100, 0.00001)))) - 1) * 100)::numeric, 4) AS acumulado_sql
      FROM (
        SELECT valor_mensal
        FROM public.indices_governamentais
        WHERE nome_indice = 'INCC'
          AND data_referencia <= '2026-06-30'
        ORDER BY data_referencia DESC
        LIMIT 12
      ) sub;
    `);

    console.log(`- Cálculo direto via SQL no banco (fórmula da Trigger): ${resSql.rows[0].acumulado_sql}%`);

  } catch (error) {
    console.error('❌ Erro na consulta:', error);
  } finally {
    await client.end();
  }
}

run();
