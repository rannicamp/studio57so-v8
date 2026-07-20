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

async function run() {
  try {
    const txs = await callTool('buscar_lancamentos_financeiros', {});
    
    // Group Sicoob Corrente (ID 119) by month
    const sicoobCorrenteTxs = txs.filter(t => t.conta && t.conta.id === 119);
    
    const months = {};
    for (const t of sicoobCorrenteTxs) {
      const month = t.data_vencimento ? t.data_vencimento.substring(0, 7) : 'Sem Data';
      if (!months[month]) {
        months[month] = { count: 0, sum: 0 };
      }
      months[month].count++;
      months[month].sum += t.valor;
    }
    
    console.log("=== SICOOB CORRENTE TRANSACTION COUNT AND SUM BY MONTH ===");
    console.log(months);
  } catch (e) {
    console.error(e);
  }
}

run();
