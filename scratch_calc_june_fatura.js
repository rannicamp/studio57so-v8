const fs = require('fs');
const path = require('path');

const ofxPath = "c:\\Users\\ranni\\OneDrive\\02 - Financas\\01_CONTROLE_FINANCEIRO\\2026\\06_Junho\\06_FATURA_SICOOB.ofx";

async function run() {
  try {
    const content = fs.readFileSync(ofxPath, 'utf8');
    const regex = /<TRNAMT>(.*?)(?:<\/TRNAMT>|\n|$)/g;
    let match;
    let sum = 0;
    let count = 0;
    while ((match = regex.exec(content)) !== null) {
      const val = parseFloat(match[1].trim());
      // credit card charges are negative in OFX
      if (val < 0) {
        sum += Math.abs(val);
        count++;
      }
      console.log(`Val: ${val}`);
    }
    console.log(`Total transactions count: ${count}`);
    console.log(`Total sum: R$ ${sum.toFixed(2)}`);
  } catch (e) {
    console.error(e);
  }
}

run();
