const fs = require('fs');
const path = require('path');
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

// Contacts map
const contactMap = {
  'coelho diniz': 6490,
  'diniz': 6490,
  'sicoob': 6491,
  'banco inter': 6492,
  'playstation': 6493,
  'tinder': 6494,
  'amazon': 6495,
  'google': 6496,
  'ifood': 6497,
  'juliana': 6498,
  'ibipar': 6499,
  'plano de saúde': 6500,
  'plano de saude': 6500,
  'seguro funerário': 6501,
  'seguro funerario': 6501,
  'posto tne ilha': 6502,
  'tele cerveja da ilha': 6503,
  'estacionamento toda ho': 6504,
  'restaurante da vilma': 6505,
  'mpreidapiza': 6506,
  'armazem vargas butiqui': 6507,
  'hausmalte': 6508,
  'alex': 6509,
  'zaqueu': 6510,
  'naim': 6511,
  'unimed': 6512
};

// Categories
const catAssinaturas = 428;
const catComerFora = 413;
const catCompras = 429;
const catImpostos = 426;
const catInvestigar = 414;
const catJuros = 425;
const catLazer = 431;
const catMoradia = 416;
const catOutrosDespesa = 415;
const catOutrosReceita = 420;
const catSaude = 430;
const catSeguros = 423;
const catSupermercado = 427;
const catTaxasBancarias = 422;
const catTransporte = 424;
const catTransfPropDespesa = 417;
const catTransfPropReceita = 433;

function getCategoryAndFav(memo, val, isDespesa) {
  const memoLower = memo.toLowerCase();
  let categoryId = isDespesa ? catOutrosDespesa : catOutrosReceita;
  let favId = null;

  // Contact matching
  for (const [key, id] of Object.entries(contactMap)) {
    if (memoLower.includes(key)) {
      favId = id;
      break;
    }
  }

  // Category matching
  if (memoLower.includes('coelho diniz') || memoLower.includes('diniz')) {
    categoryId = catSupermercado;
  } else if (memoLower.includes('google') || memoLower.includes('amazon') || memoLower.includes('playstation')) {
    categoryId = catAssinaturas;
  } else if (memoLower.includes('tinder') || memoLower.includes('tele cerveja') || memoLower.includes('hausmalte')) {
    categoryId = catLazer;
  } else if (memoLower.includes('ifood') || memoLower.includes('restaurante') || memoLower.includes('gauchao') || memoLower.includes('churrasquinho') || memoLower.includes('padaria')) {
    categoryId = catComerFora;
  } else if (memoLower.includes('posto') || memoLower.includes('estacionamento') || memoLower.includes('transporte')) {
    categoryId = catTransporte;
  } else if (memoLower.includes('farmacia') || memoLower.includes('indiana') || memoLower.includes('plano de saude') || memoLower.includes('plano de saúde') || memoLower.includes('unimed')) {
    categoryId = catSaude;
    if (memoLower.includes('plano de saude') || memoLower.includes('plano de saúde')) {
      favId = contactMap['unimed'];
    }
  } else if (memoLower.includes('seguro')) {
    categoryId = catSeguros;
  } else if (memoLower.includes('tarifa') || memoLower.includes('pacote') || memoLower.includes('mensalidade conta') || memoLower.includes('anuidade')) {
    categoryId = catTaxasBancarias;
  } else if (memoLower.includes('juros') || memoLower.includes('encargos')) {
    categoryId = catJuros;
  } else if (memoLower.includes('iof')) {
    categoryId = catImpostos;
  } else if (memoLower.includes('ibipar') || memoLower.includes('aluguel')) {
    categoryId = catMoradia;
  } else if (memoLower.includes('demais empresas') || memoLower.includes('boleto intercredis') || memoLower.includes('pagamento de boleto') || memoLower.includes('pagamento debito em conta') || memoLower.includes('pagamento-boleto bancario')) {
    categoryId = isDespesa ? catTransfPropDespesa : catTransfPropReceita;
    favId = contactMap['sicoob'];
  } else if (memoLower.includes('transf.contas intercredis') || memoLower.includes('cred.transf.contas')) {
    categoryId = isDespesa ? catTransfPropDespesa : catTransfPropReceita;
  }

  return { categoryId, favId };
}

const basePath = "c:\\Users\\ranni\\OneDrive\\02 - Financas\\01_CONTROLE_FINANCEIRO";

const sicoobCorrenteFiles = [
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204240.ofx", // Jan
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204223.ofx", // Feb
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204209.ofx", // Mar
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204146.ofx", // Apr
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204119.ofx", // May
  "2026\\06_Junho\\06_EXTRATO_SICOOB.ofx"                             // Jun
];

const sicoobCartaoFiles = [
  "2026\\fatura-cartao.ofx",     // Dec 2025 (due Jan 2026)
  "2026\\fatura-cartao (1).ofx", // Jan 2026 (due Feb 2026)
  "2026\\fatura-cartao (2).ofx", // Feb 2026 (due Mar 2026)
  "2026\\fatura-cartao (3).ofx", // Mar 2026 (due Apr 2026)
  "2026\\fatura-cartao (4).ofx", // Apr 2026 (due May 2026)
  "2026\\fatura-cartao (5).ofx"  // May 2026 (due Jun 2026)
  // June 2026 fatura (6) was already imported and corrected!
];

function parseOFX(filePath) {
  const fullPath = path.join(basePath, filePath);
  if (!fs.existsSync(fullPath)) return [];
  const content = fs.readFileSync(fullPath, 'utf8');
  const txBlocks = content.split('<STMTTRN>');
  txBlocks.shift();
  const txs = [];
  txBlocks.forEach(block => {
    const typeMatch = block.match(/<TRNTYPE>(.*?)(?:<\/TRNTYPE>|\n|$)/);
    const dateMatch = block.match(/<DTPOSTED>(.*?)(?:<\/DTPOSTED>|\n|$)/);
    const amtMatch = block.match(/<TRNAMT>(.*?)(?:<\/TRNAMT>|\n|$)/);
    const memoMatch = block.match(/<MEMO>(.*?)(?:<\/MEMO>|\n|$)/);
    if (typeMatch && dateMatch && amtMatch) {
      const type = typeMatch[1].trim();
      const rawDate = dateMatch[1].trim().substring(0, 8);
      const date = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
      const val = parseFloat(amtMatch[1].trim());
      const memo = memoMatch ? memoMatch[1].trim() : '';
      txs.push({ date, val, memo });
    }
  });
  return txs;
}

function getTxHash(date, val, memo) {
  // Hash combining date, absolute value, and trimmed description
  const cleanMemo = memo.toLowerCase().substring(0, 15).trim();
  return `${date}_${Math.abs(val).toFixed(2)}_${cleanMemo}`;
}

async function run() {
  try {
    const sicoobCorrenteId = 119;
    const sicoobCartaoId = 120;

    console.log("=== STEP 1: INITIAL BALANCE ===");
    const existingTxs = await callTool('buscar_lancamentos_financeiros', {});
    const initialBalTx = existingTxs.find(t => t.data_vencimento === '2025-12-31' && t.descricao.includes('Saldo Inicial'));
    if (!initialBalTx) {
      const ibRes = await callTool('lancar_receita', {
        descricao: 'Aporte de Saldo Inicial Sicoob Corrente (31/12/2025)',
        valor: 15530.89,
        data_vencimento: '2025-12-31',
        data_pagamento: '2025-12-31',
        status: 'Pago',
        conta_financeira_id: sicoobCorrenteId,
        categoria_id: catOutrosReceita
      });
      console.log("Created initial balance transaction:", ibRes);
    } else {
      console.log("Initial balance transaction already exists!");
    }

    // Refresh transactions list
    const currentTxs = await callTool('buscar_lancamentos_financeiros', {});
    
    // Build DB Hash Set for checking account and card
    const sicoobCorrenteDbHashes = new Set();
    const sicoobCartaoDbHashes = new Set();

    currentTxs.forEach(t => {
      const hash = getTxHash(t.data_vencimento, t.valor, t.descricao);
      if (t.conta && t.conta.id === sicoobCorrenteId) {
        sicoobCorrenteDbHashes.add(hash);
      } else if (t.conta && t.conta.id === sicoobCartaoId) {
        sicoobCartaoDbHashes.add(hash);
      }
    });

    console.log(`\n=== STEP 2: IMPORTING SICOOB CORRENTE FALTANTES ===`);
    let ccImportedCount = 0;
    for (const file of sicoobCorrenteFiles) {
      const parsed = parseOFX(file);
      for (const t of parsed) {
        const hash = getTxHash(t.date, t.val, t.memo);
        if (!sicoobCorrenteDbHashes.has(hash)) {
          const isDespesa = t.val < 0;
          const { categoryId, favId } = getCategoryAndFav(t.memo, t.val, isDespesa);
          const args = {
            descricao: t.memo,
            valor: Math.abs(t.val),
            data_vencimento: t.date,
            data_pagamento: t.date,
            status: 'Pago',
            conta_financeira_id: sicoobCorrenteId,
            categoria_id: categoryId
          };
          if (favId) args.favorecido_contato_id = favId;
          
          const res = isDespesa ? await callTool('lancar_despesa', args) : await callTool('lancar_receita', args);
          console.log(`Imported Corrente: ${t.date} | R$ ${t.val} | ${t.memo} -> ID ${res.id || res.lancamento?.id}`);
          sicoobCorrenteDbHashes.add(hash);
          ccImportedCount++;
        }
      }
    }
    console.log(`Total Corrente transactions imported: ${ccImportedCount}`);

    console.log(`\n=== STEP 3: IMPORTING SICOOB CARTÃO FALTANTES ===`);
    let cardImportedCount = 0;
    for (const file of sicoobCartaoFiles) {
      const parsed = parseOFX(file);
      for (const t of parsed) {
        const hash = getTxHash(t.date, t.val, t.memo);
        if (!sicoobCartaoDbHashes.has(hash)) {
          const isDespesa = t.val < 0;
          
          // Credit card payments are recipes, purchases are despesas.
          // OFX credit card charges are negative in OFX, credits are positive.
          const { categoryId, favId } = getCategoryAndFav(t.memo, t.val, isDespesa);
          const args = {
            descricao: t.memo,
            valor: Math.abs(t.val),
            data_vencimento: t.date, // Purchase date passed as purchase date!
            status: 'Pago',
            conta_financeira_id: sicoobCartaoId,
            categoria_id: categoryId
          };
          if (favId) args.favorecido_contato_id = favId;
          
          const res = isDespesa ? await callTool('lancar_despesa', args) : await callTool('lancar_receita', args);
          console.log(`Imported Sicoob Cartão: ${t.date} | R$ ${t.val} | ${t.memo} -> ID ${res.id || res.lancamento?.id}`);
          sicoobCartaoDbHashes.add(hash);
          cardImportedCount++;
        }
      }
    }
    console.log(`Total Cartão transactions imported: ${cardImportedCount}`);

    console.log(`\n=== STEP 4: LINKING CARD PAYMENTS BY UUID ===`);
    // Refresh transactions list
    const allTxs = await callTool('buscar_lancamentos_financeiros', {});
    
    // Sicoob Corrente payments: Despesas with category 417 (Transferências Próprias)
    // containing 'DEMAIS EMPRESAS' or 'BOLETO INTERCREDIS' in description, or similar.
    const ccPayments = allTxs.filter(t => 
      t.conta && t.conta.id === sicoobCorrenteId &&
      t.tipo === 'Despesa' &&
      (t.descricao.toLowerCase().includes('demais empresas') || t.descricao.toLowerCase().includes('boleto intercredis'))
    );

    // Sicoob Cartão payments: Receitas in account 120 (Sicoob Cartão)
    const cardPayments = allTxs.filter(t =>
      t.conta && t.conta.id === sicoobCartaoId &&
      t.tipo === 'Receita' &&
      (t.descricao.toLowerCase().includes('pagamento') || t.descricao.toLowerCase().includes('debito em conta'))
    );

    console.log(`Found checking account payments: ${ccPayments.length}`);
    console.log(`Found card account payments: ${cardPayments.length}`);

    // Match them!
    // Since card payment might happen on slightly different date, match by absolute amount.
    // Ensure we don't match already matched ones (which would have a shared transferencia_id already).
    for (const ccPay of ccPayments) {
      if (ccPay.transferencia_id) {
        console.log(`Checking account transaction ${ccPay.id} (R$ ${ccPay.valor}) already linked!`);
        continue;
      }

      // Find an unmatched card payment with the same absolute value
      const targetVal = Math.abs(ccPay.valor);
      const matchedCardPay = cardPayments.find(cp => 
        !cp.transferencia_id && 
        Math.abs(cp.valor) === targetVal &&
        Math.abs(new Date(cp.data_vencimento) - new Date(ccPay.data_vencimento)) <= 8 * 24 * 60 * 60 * 1000 // within 8 days
      );

      if (matchedCardPay) {
        console.log(`Matching:`);
        console.log(`  CC Pay: ${ccPay.id} | ${ccPay.data_vencimento} | R$ ${ccPay.valor} | ${ccPay.descricao}`);
        console.log(`  Card Pay: ${matchedCardPay.id} | ${matchedCardPay.data_vencimento} | R$ ${matchedCardPay.valor} | ${matchedCardPay.descricao}`);
        
        // Generate UUID
        const sharedUuid = uuidv4();

        // Delete old transactions
        await callTool('deletar_lancamento', { id: ccPay.id });
        await callTool('deletar_lancamento', { id: matchedCardPay.id });

        // Re-create them with UUID and category "Transferências Próprias"
        const newCcPay = await callTool('lancar_despesa', {
          descricao: ccPay.descricao,
          valor: targetVal,
          data_vencimento: ccPay.data_vencimento,
          data_pagamento: ccPay.data_pagamento || ccPay.data_vencimento,
          status: 'Pago',
          conta_financeira_id: sicoobCorrenteId,
          categoria_id: catTransfPropDespesa,
          transferencia_id: sharedUuid
        });
        console.log(`  Recreated CC Pay ID: ${newCcPay.id || newCcPay.lancamento?.id}`);

        const newCardPay = await callTool('lancar_receita', {
          descricao: matchedCardPay.descricao,
          valor: targetVal,
          data_vencimento: matchedCardPay.data_vencimento,
          data_pagamento: matchedCardPay.data_pagamento || matchedCardPay.data_vencimento,
          status: 'Pago',
          conta_financeira_id: sicoobCartaoId,
          categoria_id: catTransfPropReceita,
          transferencia_id: sharedUuid
        });
        console.log(`  Recreated Card Pay ID: ${newCardPay.id || newCardPay.lancamento?.id}`);
      } else {
        console.log(`No match found for checking account payment ${ccPay.id} (R$ ${ccPay.valor})`);
      }
    }

    console.log("\n=== COMPLETED SUCCESSFULLY ===");
  } catch (e) {
    console.error("Execution error:", e);
  }
}

run();
