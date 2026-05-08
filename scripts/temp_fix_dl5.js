const fs = require('fs');

const path1 = 'components/shared/FilePreviewModal.js';
let c1 = fs.readFileSync(path1, 'utf8');
c1 = c1.replace(/'documento'\)'}/g, "'documento')} ");
fs.writeFileSync(path1, c1);

const path2 = 'components/shared/GaleriaMarketing.js';
if (fs.existsSync(path2)) {
  let c2 = fs.readFileSync(path2, 'utf8');
  c2 = c2.replace(/'documento'\)'}/g, "'documento')} ");
  fs.writeFileSync(path2, c2);
}

console.log("Syntax error de aspas sobrando corrigido.");
