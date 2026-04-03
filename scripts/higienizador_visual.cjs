const fs = require('fs');
const path = require('path');

const targetFolders = [
    path.join(__dirname, '../app'),
    path.join(__dirname, '../components')
];

let filesModified = 0;

// Regras de Limpeza
const rules = [
    {
        // Troca classes Laranja por Azul padrão
        regex: /\b(text|bg|border|ring|fill|stroke)-orange-\d+\b/g,
        replace: (match, p1) => `${p1}-blue-600`
    },
    {
        // Troca a cor hexadecimal laranja sólida pelo azul Tailwind #2563EB
        regex: /#F97316/gi,
        replace: '#2563EB'
    },
    {
        // Substitui a base do gradiente por base sólida
        regex: /\bbg-gradient-to-[a-z]+\b/g,
        replace: 'bg-blue-600'
    },
    {
        // Limpa os resquícios das origens dos gradientes antigos
        regex: /\bfrom-(blue|purple|orange|red|gray|green)-\d+\b/g,
        replace: 'text-white' // injeta text branco no lugar
    },
    {
        // Limpa os resquícios do fim/meio dos gradientes antigos
        regex: /\b(via|to)-(blue|purple|orange|red|gray|green)-\d+\b/g,
        replace: ''
    }
];

function processDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.next') continue;
            processDirectory(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            cleanFile(fullPath);
        }
    }
}

function cleanFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    rules.forEach(rule => {
        content = content.replace(rule.regex, rule.replace);
    });

    // Strip duplicate whitespaces that may have been created by empty replacements
    content = content.replace(/ className="(\s+)/g, ' className="');
    content = content.replace(/ \s+/g, ' ');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        filesModified++;
        console.log(`[LIMPO] ${path.relative(path.join(__dirname, '..'), filePath)}`);
    }
}

console.log('🧹 Iniciando Higienizador Visual Elo 57...');
targetFolders.forEach(folder => processDirectory(folder));
console.log(`✅ ${filesModified} arquivos foram higienizados e padronizados para Azul Institucional.`);
