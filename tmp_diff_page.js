const fs = require('fs');
let C = fs.readFileSync('app/(main)/pedidos/page.js', 'utf8');

C = C.replace(
  'itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome, razao_social), etapa:etapa_id(nome_etapa), subetapa:subetapa_id(nome_subetapa)',
  'itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome, razao_social), etapa:etapa_id(nome_etapa), subetapa:subetapa_id(nome_subetapa), material:material_id(classificacao)'
);

C = C.replace(
  'const hasItemFilters = debouncedFilters.fornecedorIds.length > 0 || debouncedFilters.etapaIds.length > 0 || debouncedFilters.subetapaIds.length > 0 || debouncedFilters.tipoOperacao.length > 0;',
  'const hasItemFilters = debouncedFilters.fornecedorIds.length > 0 || debouncedFilters.etapaIds.length > 0 || debouncedFilters.subetapaIds.length > 0 || debouncedFilters.tipoOperacao.length > 0 || debouncedFilters.classificacao?.length > 0;'
);

C = C.replace(
  'const matchTipo = debouncedFilters.tipoOperacao.length === 0 || debouncedFilters.tipoOperacao.includes(item.tipo_operacao);\r\n  return matchFornecedor && matchEtapa && matchSubetapa && matchTipo;\r\n  });',
  `const matchTipo = debouncedFilters.tipoOperacao.length === 0 || debouncedFilters.tipoOperacao.includes(item.tipo_operacao);\n  const matchClassificacao = !debouncedFilters.classificacao || debouncedFilters.classificacao.length === 0 || debouncedFilters.classificacao.includes(item.material?.classificacao);\n  return matchFornecedor && matchEtapa && matchSubetapa && matchTipo && matchClassificacao;\n  });`
);
// fallback if \r\n vs \n
C = C.replace(
  'const matchTipo = debouncedFilters.tipoOperacao.length === 0 || debouncedFilters.tipoOperacao.includes(item.tipo_operacao);\n  return matchFornecedor && matchEtapa && matchSubetapa && matchTipo;\n  });',
  `const matchTipo = debouncedFilters.tipoOperacao.length === 0 || debouncedFilters.tipoOperacao.includes(item.tipo_operacao);\n  const matchClassificacao = !debouncedFilters.classificacao || debouncedFilters.classificacao.length === 0 || debouncedFilters.classificacao.includes(item.material?.classificacao);\n  return matchFornecedor && matchEtapa && matchSubetapa && matchTipo && matchClassificacao;\n  });`
);

fs.writeFileSync('app/(main)/pedidos/page.js', C);
console.log('Saved page');
