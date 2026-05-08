const fs = require('fs');
const path1 = 'components/shared/GerenciadorAnexosGlobal.js';
const path2 = 'components/shared/FilePreviewModal.js';

// ---- FIX 1: GerenciadorAnexosGlobal.js ----
let content1 = fs.readFileSync(path1, 'utf8');

const target1 = `      fetch(anexo.public_url)
        .then(res => res.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = anexo.nome_arquivo || 'documento';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        })`;

const replacement1 = `      new Promise((resolve) => {
          const a = document.createElement('a');
          a.style.display = 'none';
          const separator = anexo.public_url.includes('?') ? '&' : '?';
          a.href = anexo.public_url + separator + 'download=true';
          a.download = anexo.nome_arquivo || 'documento';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          resolve();
        })`;

content1 = content1.replace(target1, replacement1);
fs.writeFileSync(path1, content1);

// ---- FIX 2: FilePreviewModal.js ----
let content2 = fs.readFileSync(path2, 'utf8');

const target2_1 = `<a href={anexo.public_url} download={anexo.nome_arquivo} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Baixar">`;
const replacement2_1 = `<a href={anexo.public_url + (anexo.public_url.includes('?') ? '&' : '?') + 'download=true'} download={anexo.nome_arquivo} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Baixar">`;

const target2_2 = `<a href={anexo.public_url} download className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition">Baixar Arquivo ({ext})</a>`;
const replacement2_2 = `<a href={anexo.public_url + (anexo.public_url.includes('?') ? '&' : '?') + 'download=true'} download className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition">Baixar Arquivo ({ext})</a>`;

content2 = content2.replace(target2_1, replacement2_1).replace(target2_2, replacement2_2);
fs.writeFileSync(path2, content2);

console.log("Substituição concluída.");
