const fs = require('fs');

let contents = fs.readFileSync('components/financeiro/LancamentoDetalhesSidebar.js', 'utf8');

contents = contents.replace(
  `const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(anexo.caminho_arquivo);\n      if (data?.publicUrl) {\n        anexoAdaptado.public_url = data.publicUrl;\n      }`,
  `if (anexo.caminho_arquivo.startsWith('http')) {\n        anexoAdaptado.public_url = anexo.caminho_arquivo;\n      } else {\n        const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(anexo.caminho_arquivo);\n        if (data?.publicUrl) {\n          anexoAdaptado.public_url = data.publicUrl;\n        }\n      }`
);

contents = contents.replace(
  `public_url: a.public_url || supabase.storage.from('documentos-financeiro').getPublicUrl(a.caminho_arquivo).data.publicUrl`,
  `public_url: a.public_url || (typeof a.caminho_arquivo === 'string' && a.caminho_arquivo.startsWith('http') ? a.caminho_arquivo : supabase.storage.from('documentos-financeiro').getPublicUrl(a.caminho_arquivo).data.publicUrl)`
);

fs.writeFileSync('components/financeiro/LancamentoDetalhesSidebar.js', contents);
console.log("Updated LancamentoDetalhesSidebar.js");

