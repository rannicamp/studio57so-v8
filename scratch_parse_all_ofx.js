const fs = require('fs');
const path = require('path');

const basePath = "c:\\Users\\ranni\\OneDrive\\02 - Financas\\01_CONTROLE_FINANCEIRO";

const sicoobCorrenteFiles = [
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204240.ofx", // Jan
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204223.ofx", // Feb
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204209.ofx", // Mar
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204146.ofx", // Apr
  "2026\\extrato-conta-corrente-ofx-money_202607_20260709204119.ofx", // May
  "2026\\06_Junho\\06_EXTRATO_SICOOB.ofx",                            // Jun
  "2026\\07_Julho\\extrato-conta-corrente-ofx-money_202607_20260719103547.ofx" // Jul
];

const sicoobCartaoFiles = [
  "2026\\fatura-cartao.ofx",     // Dec 2025 (due Jan 2026)
  "2026\\fatura-cartao (1).ofx", // Jan 2026 (due Feb 2026)
  "2026\\fatura-cartao (2).ofx", // Feb 2026 (due Mar 2026)
  "2026\\fatura-cartao (3).ofx", // Mar 2026 (due Apr 2026)
  "2026\\fatura-cartao (4).ofx", // Apr 2026 (due May 2026)
  "2026\\fatura-cartao (5).ofx", // May 2026 (due Jun 2026)
  "2026\\fatura-cartao (6).ofx"  // June 2026 (due Jul 2026)
];

function parseOFX(filePath) {
  const fullPath = path.join(basePath, filePath);
  if (!fs.existsSync(fullPath)) {
    return { error: 'File not found' };
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Find all <STMTTRN> blocks
  const txBlocks = content.split('<STMTTRN>');
  txBlocks.shift(); // remove header part
  
  const txs = [];
  txBlocks.forEach(block => {
    const typeMatch = block.match(/<TRNTYPE>(.*?)(?:<\/TRNTYPE>|\n|$)/);
    const dateMatch = block.match(/<DTPOSTED>(.*?)(?:<\/DTPOSTED>|\n|$)/);
    const amtMatch = block.match(/<TRNAMT>(.*?)(?:<\/TRNAMT>|\n|$)/);
    const idMatch = block.match(/<FITID>(.*?)(?:<\/FITID>|\n|$)/);
    const memoMatch = block.match(/<MEMO>(.*?)(?:<\/MEMO>|\n|$)/);
    
    if (typeMatch && dateMatch && amtMatch) {
      const type = typeMatch[1].trim();
      const rawDate = dateMatch[1].trim().substring(0, 8); // YYYYMMDD
      const date = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
      const val = parseFloat(amtMatch[1].trim());
      const fitid = idMatch ? idMatch[1].trim() : '';
      const memo = memoMatch ? memoMatch[1].trim() : '';
      
      txs.push({ type, date, val, fitid, memo });
    }
  });
  
  return txs;
}

function run() {
  console.log("=== SICOOB CORRENTE FILES ANALYSIS ===");
  sicoobCorrenteFiles.forEach(f => {
    const txs = parseOFX(f);
    if (txs.error) {
      console.log(`${f}: ${txs.error}`);
      return;
    }
    const cardPayments = txs.filter(t => t.memo.toLowerCase().includes('demais empresas') || t.memo.toLowerCase().includes('boleto intercredis') || t.memo.toLowerCase().includes('pagamento de boleto'));
    const totalDespesas = txs.filter(t => t.val < 0).reduce((acc, t) => acc + Math.abs(t.val), 0);
    const totalReceitas = txs.filter(t => t.val > 0).reduce((acc, t) => acc + t.val, 0);
    console.log(`${f}:`);
    console.log(`  Transactions: ${txs.length} (Despesas: ${txs.filter(t => t.val < 0).length}, Receitas: ${txs.filter(t => t.val > 0).length})`);
    console.log(`  Total Despesas: R$ ${totalDespesas.toFixed(2)} | Total Receitas: R$ ${totalReceitas.toFixed(2)}`);
    if (cardPayments.length > 0) {
      console.log(`  Credit Card Payments found in this month's statement:`);
      cardPayments.forEach(p => {
        console.log(`    - ${p.date} | R$ ${p.val} | ${p.memo}`);
      });
    }
  });

  console.log("\n=== SICOOB CARTÃO FILES ANALYSIS ===");
  sicoobCartaoFiles.forEach(f => {
    const txs = parseOFX(f);
    if (txs.error) {
      console.log(`${f}: ${txs.error}`);
      return;
    }
    const totalExpenses = txs.filter(t => t.val < 0).reduce((acc, t) => acc + Math.abs(t.val), 0);
    const totalCredits = txs.filter(t => t.val > 0).reduce((acc, t) => acc + t.val, 0);
    console.log(`${f}:`);
    console.log(`  Transactions: ${txs.length}`);
    console.log(`  Total Expenses (Purchases): R$ ${totalExpenses.toFixed(2)} | Total Credits: R$ ${totalCredits.toFixed(2)}`);
  });
}

run();
