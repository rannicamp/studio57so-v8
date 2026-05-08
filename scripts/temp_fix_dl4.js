const fs = require('fs');

// 1. Corrigir FilePreviewModal.js
const path1 = 'components/shared/FilePreviewModal.js';
let c1 = fs.readFileSync(path1, 'utf8');
c1 = c1.replace(/download=true/g, "download=' + encodeURIComponent(anexo.nome_arquivo || 'documento')");
fs.writeFileSync(path1, c1);

// 2. Corrigir GaleriaMarketing.js
const path2 = 'components/shared/GaleriaMarketing.js';
if (fs.existsSync(path2)) {
  let c2 = fs.readFileSync(path2, 'utf8');
  c2 = c2.replace(/download=true/g, "download=' + encodeURIComponent(anexo.nome_arquivo || 'documento')");
  fs.writeFileSync(path2, c2);
}

// 3. Corrigir GerenciadorAnexosGlobal.js
const path3 = 'components/shared/GerenciadorAnexosGlobal.js';
let c3 = fs.readFileSync(path3, 'utf8');
const target = `window.open(downloadUrl, '_blank');`;
const replacement = `const a = document.createElement('a');
      a.href = downloadUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);`;
c3 = c3.replace(target, replacement);
fs.writeFileSync(path3, c3);

console.log("Correções de download aplicadas com sucesso!");
