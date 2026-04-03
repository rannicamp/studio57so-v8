const fs = require('fs');
const path = require('path');

const targetFolders = [
    path.join(__dirname, '../app'),
    path.join(__dirname, '../components')
];

let totalFilesScanned = 0;
const results = {
    RLS_NULL: [],
    BAD_ICONS: [],
    DESIGN_ORANGE: [],
    DESIGN_GRADIENT: [],
    CONSOLE_LOGS: [],
    EDGE_VULNERABILITY: []
};

// Padrões Regex
const rxRlsNull = /organizacao_id\s*(?:===|==|=|is)\s*null/gi;
const rxBadIcons = /faPen\b|faPenToSquare\b|faPencilAlt\b|faTrashAlt\b|faXmark\b/g;
const rxOrange = /text-orange-\d+|bg-orange-\d+|border-orange-\d+|#F97316/gi;
const rxGradient = /bg-gradient-to/gi;
const rxConsole = /console\.log\(/g;

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.next') continue;
            scanDirectory(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            analyzeFile(fullPath, file);
            totalFilesScanned++;
        }
    }
}

function analyzeFile(filePath, fileName) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    // 1. RLS Grave
    if (rxRlsNull.test(content)) {
        results.RLS_NULL.push(relativePath);
    }
    // 2. Ícones Proibidos
    if (rxBadIcons.test(content)) {
        results.BAD_ICONS.push(relativePath);
    }
    // 3. Cores Laranja (Descontinuado)
    if (rxOrange.test(content)) {
        results.DESIGN_ORANGE.push(relativePath);
    }
    // 4. Gradientes
    if (rxGradient.test(content)) {
        results.DESIGN_GRADIENT.push(relativePath);
    }
    // 5. Console.logs
    const logMatch = content.match(rxConsole);
    if (logMatch && logMatch.length > 0) {
        results.CONSOLE_LOGS.push({ file: relativePath, count: logMatch.length });
    }
    
    // 6. Anti-Crash Middleware / Server Actions
    // Se tem await supabase e não tem try/catch, acender flag
    if (content.includes('await supabase') || content.includes('createClient().from')) {
        if (!content.includes('try {') && !content.includes('try{')) {
            // Se for Server Action ou Componente Sever-side
            if (content.includes('"use server"') || fileName === 'middleware.js' || content.includes('export async function')) {
                results.EDGE_VULNERABILITY.push(relativePath);
            }
        }
    }
}

console.log('🕵️‍♂️ Iniciando Varredura Supra Elo 57...');
targetFolders.forEach(folder => scanDirectory(folder));
console.log(`✅ ${totalFilesScanned} arquivos escaneados.`);

const outputFile = path.join(__dirname, 'auditoria_resultados.json');
fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
console.log(`📄 Resultados salvos em: ${outputFile}`);
