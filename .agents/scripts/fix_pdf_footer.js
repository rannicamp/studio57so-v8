const fs = require('fs');

let lines = fs.readFileSync('components/SimuladorPrintView.js', 'utf8').split('\n');

// Find and delete the old "Avisos e Observações" block
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* ── ⚠️ Avisos e Observações ───────────────────────── */}')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i].includes(')}')) {
    // Wait, there are multiple ")}", so let's just delete a fixed number of lines or up to "</section>" + next line
    endIdx = startIdx + 8; // It's exactly 8 lines of code in the block
    break;
  }
}

if (startIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx + 1);
}

// Insert the new block at the bottom, just before </main>
const insertIdx = lines.findIndex(l => l.includes('</main>'));
if (insertIdx !== -1) {
  const newBlock = [
    '        {/* ── ⚠️ Avisos e Observações ───────────────────────── */}',
    '        <section className="mt-8 text-center pb-4">',
    '          <p className="whitespace-pre-wrap text-[10px] text-gray-500 leading-relaxed">',
    '            {empreendimento?.observacoes || \'*Correção mensal pelo INCC até a entrega das chaves, após entrega IGP-M + 1% a.m.\\n**Sujeito a alteração sem aviso prévio.\'}',
    '          </p>',
    '        </section>'
  ];
  lines.splice(insertIdx, 0, ...newBlock);
}

fs.writeFileSync('components/SimuladorPrintView.js', lines.join('\n'));
console.log('PDF Footer updated successfully!');
