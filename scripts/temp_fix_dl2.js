const fs = require('fs');
const path = 'components/shared/GerenciadorAnexosGlobal.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /const handleDownloadBase = async \(anexo\) => \{[\s\S]*?console\.error\("Erro no download:", error\);\s*\}\s*\};/;

const replacement = `const handleDownloadBase = async (anexo) => {
    if (onDownload) {
      onDownload(anexo);
      return;
    }
    // Abre a URL pública com a flag download=true do Supabase em nova aba
    // Isso delega o download nativamente para o navegador e evita crash de memória
    try {
      const fileName = encodeURIComponent(anexo.nome_arquivo || 'documento');
      const separator = anexo.public_url.includes('?') ? '&' : '?';
      const downloadUrl = anexo.public_url + separator + 'download=' + fileName;
      window.open(downloadUrl, '_blank');
      toast.success('Download iniciado!');
    } catch (error) {
      console.error("Erro no download:", error);
      toast.error('Erro ao iniciar o download.');
    }
  };`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log("GerenciadorAnexosGlobal atualizado.");
