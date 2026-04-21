const fs = require('fs');
let c = fs.readFileSync('components/almoxarifado/AdicionarMaterialManualModal.js', 'utf8');

c = c.replace(
  /observacao: `Adição manual de material: \$\{materialData\.descricao\}`/g,
  "observacao: materialData.tipo_operacao === 'Aluguel' ? `[ALUGUEL] Adição manual de material: ${materialData.descricao}` : `Adição manual de material: ${materialData.descricao}`"
);

// Add the default tipo_operacao to state
c = c.replace(
  /unidade_medida: 'unid\.',\n\s*classificacao: 'Equipamento',/g,
  "unidade_medida: 'unid.',\n classificação: 'Equipamento',\n tipo_operacao: 'Compra',"
);

// Fix the typo just introduced if any
c = c.replace(/classificação:/g, "classificacao:");

// Insert the new UI component (Dropdown for Tipo de Operação)
const newSelect = `
 <div>
 <label className="block text-sm font-medium">Operação</label>
 <select
 value={item.tipo_operacao}
 onChange={(e) => setItem({ ...item, tipo_operacao: e.target.value })}
 className="mt-1 w-full p-2 border rounded-md"
 >
 <option value="Compra">Próprio (Compra)</option>
 <option value="Aluguel">Aluguel (Locação)</option>
 </select>
 </div>
`;

// Insert it right after the Classificação dropdown
c = c.replace(
  /<\/select>\n\s*<\/div>\n\s*<\/div>/g,
  `</select>\n </div>\n ${newSelect}\n </div>`
);

// We also need to change the grid-cols from 3 to 4 to accommodate the new dropdown
c = c.replace(/className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2"/g, 'className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2"');

fs.writeFileSync('components/almoxarifado/AdicionarMaterialManualModal.js', c);
