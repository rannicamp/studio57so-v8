const fs = require('fs');

const path2 = 'components/shared/FilePreviewModal.js';
let c2 = fs.readFileSync(path2, 'utf8');
c2 = c2.replace(/download=\{anexo\.nome_arquivo\}/g, 'target="_blank" rel="noopener noreferrer" download={anexo.nome_arquivo}');
c2 = c2.replace(/download className="bg-blue-600/g, 'target="_blank" rel="noopener noreferrer" download className="bg-blue-600');
fs.writeFileSync(path2, c2);

const path3 = 'components/shared/GaleriaMarketing.js';
if (fs.existsSync(path3)) {
  let c3 = fs.readFileSync(path3, 'utf8');
  c3 = c3.replace(/download=\{anexo\.nome_arquivo\}/g, 'target="_blank" rel="noopener noreferrer" download={anexo.nome_arquivo}');
  // Also add ?download=true to GaleriaMarketing if missing
  c3 = c3.replace(/href=\{anexo\.public_url\}/g, "href={anexo.public_url + (anexo.public_url.includes('?') ? '&' : '?') + 'download=true'}");
  fs.writeFileSync(path3, c3);
}

console.log("Modals and galleries updated with target=_blank.");
