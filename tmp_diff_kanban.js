const fs = require('fs');
let C = fs.readFileSync('components/pedidos/ComprasKanban.js', 'utf8');

const calcFun = `
  const calculaTotalColuna = (pedidosColuna) => {
    if (!pedidosColuna) return 0;
    return pedidosColuna.reduce((acc, pedido) => {
      const itens = pedido.itens || [];
      const totalItens = itens.reduce((soma, item) => soma + (parseFloat(item.custo_total_real) || 0), 0);
      return acc + totalItens;
    }, 0);
  };
`;

if (!C.includes('calculaTotalColuna')) {
    C = C.replace(
        '  const handleSortChange = ',
        calcFun + '\n  const handleSortChange = '
    );
}

const UI_OLD = `<div className="flex items-center gap-2">
 <span>{fase.nome}</span>
 <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
 {pedidosPorColuna[fase.id]?.length || 0}
 </span>
 </div>`;

const UI_NEW = `<div className="flex flex-col">
 <div className="flex items-center gap-2">
 <span>{fase.nome}</span>
 <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
 {pedidosPorColuna[fase.id]?.length || 0}
 </span>
 </div>
 <span className="text-xs text-gray-500 font-normal mt-0.5">
 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculaTotalColuna(pedidosPorColuna[fase.id]))}
 </span>
 </div>`;

C = C.replace(UI_OLD, UI_NEW);

fs.writeFileSync('components/pedidos/ComprasKanban.js', C);
console.log('Saved Kanban update');
