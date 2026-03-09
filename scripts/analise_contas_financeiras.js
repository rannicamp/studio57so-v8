const fs = require('fs');

const outputPath = 'C:\\Users\\ranni\\.gemini\\antigravity\\brain\\a5da230c-2ca3-4437-a4e9-0ef8e4ccbbde\\.system_generated\\steps\\160\\output.txt';

const data = fs.readFileSync(outputPath, 'utf8');
const json = JSON.parse(data);

const contasTable = json.tables.find(t => t.name === 'public.contas_financeiras' || t.name === 'public.contas');

if (contasTable) {
    console.log('--- FOUND TABLE ---');
    console.log('Name:', contasTable.name);
    console.log('Columns:');
    contasTable.columns.forEach(c => {
        console.log(`  - ${c.name} (${c.data_type})`);
    });
} else {
    console.log('Table not found.');
}
