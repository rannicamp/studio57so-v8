const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scripts/tmp_emprestimos.json', 'utf8'));

let csv = '\uFEFFID;Data;Descrição;Categoria;Tipo;Status;Valor\n';
data.forEach(i => {
    csv += `${i.id};${i.data_vencimento};${i.descricao?.replace(/;/g, ',')};${i.categorias_financeiras?.nome};${i.tipo};${i.status};${i.valor}\n`;
});

fs.writeFileSync('relatorio_emprestimos_completo.csv', csv);
console.log('CSV GERADO');
