const fs = require('fs');

function updateLayout() {
    let path = 'c:/Projetos/studio57so-v8/components/financeiro/LancamentoForm/FormCategorizacao.js';
    let content = fs.readFileSync(path, 'utf8');

    // Mudar de grid-cols-2 para grid-cols-3 na seção de transferência
    content = content.replace(
      '<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">',
      '<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">'
    );

    // Adicionar o bloco de Categoria
    const SelectDestinoEnd = `        required={true}\n      />\n    </div>`;
    const newCategoryBlock = `    <div>\n      <label className="block text-sm font-medium mb-1">Categoria (Opcional)</label>\n      <select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="w-full p-2 border rounded-md">\n        <option value="">Nenhuma / Automático</option>\n        {hierarchicalCategorias.map(c => <CategoryOption key={c.id} category={c} />)}\n      </select>\n    </div>`;

    content = content.replace(SelectDestinoEnd, SelectDestinoEnd + '\n' + newCategoryBlock);

    fs.writeFileSync(path, content, 'utf8');
}

try {
    updateLayout();
    console.log("Sucesso!");
} catch (e) {
    console.error(e);
}
