const fs = require('fs');
const path = require('path');

const filesToClean = [
    'app/(main)/empreendimentos/[id]/produtos/page.js',
    'app/(main)/empreendimentos/editar/[id]/page.js',
    'app/(main)/empreendimentos/cadastro/page.js',
    'app/(main)/rdo/page.js',
    'app/(main)/rdo/[id]/page.js',
    'app/(main)/pedidos/[id]/page.js',
    'app/(main)/contatos/editar/[id]/page.js',
    'app/(main)/financeiro/transferencias/page.js',
    'app/(main)/financeiro/categorias/page.js',
    'app/(main)/contatos/duplicatas/page.js',
    'app/(main)/contatos/cadastro/page.js',
    'app/(main)/contratos/[id]/page.js',
    'app/(main)/configuracoes/financeiro/page.js',
    'app/(corretor)/portal-contratos/[id]/page.js',
    'app/(main)/funcionarios/visualizar/[id]/page.js'
];

let modifiedFiles = 0;

filesToClean.forEach(relPath => {
    const filePath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(filePath)) {
        console.log(`Not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let newLines = [...lines];
    let toDelete = new Set();
    
    // Scan line by line for "Voltar"
    for (let i = 0; i < lines.length; i++) {
        // Find lines with "Voltar" that are NOT "Erro ao carregar" blocks
        if (lines[i].toLowerCase().includes('voltar') && !lines[i].includes('error.message') && !lines[i].includes('text-red-600') && !lines.slice(Math.max(0, i-5), i).some(l => l.includes('Erro ao carregar') || l.includes('text-red'))) {
            // Find enclosing <Link and </Link> within 10 lines
            let start = i;
            let end = i;
            
            while (start >= 0 && !lines[start].includes('<Link')) { start--; }
            while (end < lines.length && !lines[end].includes('</Link>')) { end++; }
            
            // Validate that we found them reasonably close
            if (start >= 0 && end < lines.length && (end - start) < 10) {
                // Determine if there is an enclosing <div className="print:hidden"> or similar wrapper that only contains the Link
                let divStart = start - 1;
                while (divStart >= 0 && lines[divStart].trim() === '') divStart--;
                let divEnd = end + 1;
                while (divEnd < lines.length && lines[divEnd].trim() === '') divEnd++;
                
                if (divStart >= 0 && divEnd < lines.length && lines[divStart].includes('<div') && lines[divEnd].includes('</div>')) {
                    // It's enclosed in a div. Let's mark the div and everything inside for deletion
                    for (let j = divStart; j <= divEnd; j++) {
                        toDelete.add(j);
                    }
                } else {
                    // Just delete the Link
                    for (let j = start; j <= end; j++) {
                        toDelete.add(j);
                    }
                }
            }
        }
    }
    
    if (toDelete.size > 0) {
        newLines = newLines.filter((_, idx) => !toDelete.has(idx));
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        modifiedFiles++;
        console.log(`Cleaned ${relPath} (removed ${toDelete.size} lines)`);
    }
});

console.log(`Finished. Modified ${modifiedFiles} files.`);
