const fs = require('fs');
function fixFile(path) {
  let txt = fs.readFileSync(path, 'utf8');
  txt = txt.replace(
    /public_url: a\.public_url \|\| \(typeof a\.caminho_arquivo === 'string' && a\.caminho_arquivo\.startsWith\('http'\) \? a\.caminho_arquivo : supabase\.storage\.from\('documentos-financeiro'\)\.getPublicUrl\(a\.caminho_arquivo\)\.data\.publicUrl\)/g,
    "public_url: a.public_url || (typeof a.caminho_arquivo === 'string' && a.caminho_arquivo.startsWith('http') ? a.caminho_arquivo : supabase.storage.from('documentos-financeiro').getPublicUrl(a.caminho_arquivo).data?.publicUrl?.replace(/#/g, '%23').replace(/\\?/g, '%3F'))"
  );
  
  // Also fix LancamentoDetalhesSidebar.js handlePreviewAnexo just in case
  txt = txt.replace(
    /anexoAdaptado\.public_url = data\.publicUrl;/g,
    "anexoAdaptado.public_url = data.publicUrl.replace(/#/g, '%23').replace(/\\?/g, '%3F');"
  );
  
  fs.writeFileSync(path, txt);
}
fixFile('components/financeiro/LancamentoDetalhesSidebar.js');

function fixGerenciador(path) {
  let txt = fs.readFileSync(path, 'utf8');
  txt = txt.replace(
    /await navigator\.clipboard\.writeText\(data\.publicUrl\);/g,
    "const safeUrl = data.publicUrl.replace(/#/g, '%23').replace(/\\?/g, '%3F');\n await navigator.clipboard.writeText(safeUrl);"
  );
  fs.writeFileSync(path, txt);
}
fixGerenciador('components/shared/GerenciadorAnexosGlobal.js');
