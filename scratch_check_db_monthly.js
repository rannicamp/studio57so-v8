const token = 'elo57_usr_key_f6858678bbb6946ac8a7795a3218f47d7a0b250af4c84209';
const apiUrl = 'https://studio57.arq.br/api/mcp';

async function callTool(name, args) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args }
    })
  });
  const data = await response.json();
  return JSON.parse(data.result.content[0].text);
}

const sicoobCorrenteId = 119;

async function fetchAllTxs() {
  const months = [
    { start: '2025-12-01', end: '2025-12-31' },
    { start: '2026-01-01', end: '2026-01-31' },
    { start: '2026-02-01', end: '2026-02-28' },
    { start: '2026-03-01', end: '2026-03-31' },
    { start: '2026-04-01', end: '2026-04-30' },
    { start: '2026-05-01', end: '2026-05-31' },
    { start: '2026-06-01', end: '2026-06-30' },
    { start: '2026-07-01', end: '2026-07-31' }
  ];
  let allTxs = [];
  for (const m of months) {
    const res = await callTool('buscar_lancamentos_financeiros', {
      conta_id: sicoobCorrenteId,
      data_inicio: m.start,
      data_fim: m.end
    });
    allTxs = allTxs.concat(res);
  }
  return allTxs;
}

async function run() {
  try {
    const txs = await fetchAllTxs();
    const monthly = {};
    txs.forEach(t => {
      const month = t.data_vencimento ? t.data_vencimento.substring(0, 7) : 'Sem Data';
      if (!monthly[month]) {
        monthly[month] = { count: 0, despesaSum: 0, receitaSum: 0 };
      }
      monthly[month].count++;
      if (t.tipo === 'Despesa') {
        monthly[month].despesaSum += Math.abs(t.valor);
      } else {
        monthly[month].receitaSum += t.valor;
      }
    });
    console.log("=== DB MONTHLY BREAKDOWN FOR SICOOB CORRENTE ===");
    console.log(JSON.stringify(monthly, null, 2));
  } catch (e) {
    console.error(e);
  }
}

run();
