const { v4: uuidv4 } = require('uuid');

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
  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }
  return JSON.parse(data.result.content[0].text);
}

const sicoobCorrenteId = 119;
const sicoobCartaoId = 120;
const catTransfPropDespesa = 417;
const catTransfPropReceita = 433;

async function run() {
  try {
    console.log("=== FETCHING ALL TRANSACTIONS ===");
    // To bypass potential limits, query by account
    const ccTxs = await callTool('buscar_lancamentos_financeiros', { conta_id: sicoobCorrenteId });
    const cardTxs = await callTool('buscar_lancamentos_financeiros', { conta_id: sicoobCartaoId });
    
    console.log(`Corrente transactions in DB: ${ccTxs.length}`);
    console.log(`Cartão transactions in DB: ${cardTxs.length}`);

    // Sicoob Corrente payments: Despesas with description containing 'DEMAIS EMPRESAS' or 'BOLETO INTERCREDIS' or 'PAGAMENTO'
    const ccPayments = ccTxs.filter(t => 
      t.tipo === 'Despesa' &&
      (t.descricao.toLowerCase().includes('demais empresas') || t.descricao.toLowerCase().includes('boleto intercredis') || t.descricao.toLowerCase().includes('pagamento de boleto'))
    );

    // Sicoob Cartão payments: Receitas matching 'pagamento' or 'debito em conta'
    const cardPayments = cardTxs.filter(t =>
      t.tipo === 'Receita' &&
      (t.descricao.toLowerCase().includes('pagamento') || t.descricao.toLowerCase().includes('debito em conta'))
    );

    console.log(`Checking account payments found: ${ccPayments.length}`);
    ccPayments.forEach(p => console.log(`  - ID: ${p.id} | Date: ${p.data_vencimento} | Val: ${p.valor} | Desc: ${p.descricao} | UUID: ${p.transferencia_id}`));
    
    console.log(`Card account payments found: ${cardPayments.length}`);
    cardPayments.forEach(p => console.log(`  - ID: ${p.id} | Date: ${p.data_vencimento} | Val: ${p.valor} | Desc: ${p.descricao} | UUID: ${p.transferencia_id}`));

    console.log("\n=== PAIRING AND LINKING UNLINKED PAYMENTS ===");
    for (const ccPay of ccPayments) {
      if (ccPay.transferencia_id) {
        console.log(`CC Payment ID ${ccPay.id} already linked (UUID: ${ccPay.transferencia_id})`);
        continue;
      }

      const targetVal = Math.abs(ccPay.valor);
      
      // Find an unlinked card payment with same value
      // Sicoob credit card payment date might be slightly off (up to 8 days)
      const match = cardPayments.find(cp => 
        !cp.transferencia_id &&
        Math.abs(cp.valor) === targetVal &&
        Math.abs(new Date(cp.data_vencimento) - new Date(ccPay.data_vencimento)) <= 8 * 24 * 60 * 60 * 1000
      );

      if (match) {
        console.log(`Found match:`);
        console.log(`  CC: ${ccPay.id} | ${ccPay.data_vencimento} | R$ ${ccPay.valor}`);
        console.log(`  Card: ${match.id} | ${match.data_vencimento} | R$ ${match.valor}`);

        const sharedUuid = uuidv4();

        // Delete old
        await callTool('deletar_lancamento', { id: ccPay.id });
        await callTool('deletar_lancamento', { id: match.id });

        // Recreate linked
        const newCc = await callTool('lancar_despesa', {
          descricao: ccPay.descricao,
          valor: targetVal,
          data_vencimento: ccPay.data_vencimento,
          data_pagamento: ccPay.data_pagamento || ccPay.data_vencimento,
          status: 'Pago',
          conta_financeira_id: sicoobCorrenteId,
          categoria_id: catTransfPropDespesa,
          transferencia_id: sharedUuid
        });
        console.log(`  Recreated CC Pay ID: ${newCc.id || newCc.lancamento?.id}`);

        const newCard = await callTool('lancar_receita', {
          descricao: match.descricao,
          valor: targetVal,
          data_vencimento: match.data_vencimento,
          data_pagamento: match.data_pagamento || match.data_vencimento,
          status: 'Pago',
          conta_financeira_id: sicoobCartaoId,
          categoria_id: catTransfPropReceita,
          transferencia_id: sharedUuid
        });
        console.log(`  Recreated Card Pay ID: ${newCard.id || newCard.lancamento?.id}`);
      } else {
        console.log(`No unmatched card payment found for CC Payment ID ${ccPay.id} (R$ ${ccPay.valor})`);
      }
    }

    console.log("=== COMPLETED ===");
  } catch (e) {
    console.error("Linking error:", e);
  }
}

run();
