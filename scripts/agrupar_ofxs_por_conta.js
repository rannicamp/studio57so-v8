const fs = require('fs');
const path = require('path');

const dirPath = 'C:\\Projetos\\studio57so-v8\\OFX_COPIA_SEGURANCA';
const fileNames = fs.readdirSync(dirPath);

// Regex para o padrão `ANO_MES_BANCO_CONTA.ofx`
const pattern = /^\d{4}_\d{2}_(\d{3,4})_([a-zA-Z0-9\-]+)(?:_\d+)?\.ofx$/i;

let movedCount = 0;
let errCount = 0;

for (const file of fileNames) {
    if (!file.toLowerCase().endsWith('.ofx')) continue;

    const filePath = path.join(dirPath, file);

    // Pula se for diretório
    if (fs.statSync(filePath).isDirectory()) continue;

    const match = file.match(pattern);
    if (!match) {
        console.log(`PULANDO (Não está no padrão para mover): ${file}`);
        continue;
    }

    const bankId = match[1];
    const acctId = match[2];

    // Nome da pasta que armazenará essa conta
    const folderName = `${bankId}_${acctId}`;
    const folderPath = path.join(dirPath, folderName);

    try {
        // Criar a pasta se não existir
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
            console.log(`Criou diretório: ${folderName}`);
        }

        // Caminho final do arquivo
        const destPath = path.join(folderPath, file);

        // Mover arquivo
        fs.renameSync(filePath, destPath);
        console.log(`MOVIDO: ${file} => ${folderName}\\${file}`);
        movedCount++;
    } catch (err) {
        console.error(`ERRO ao mover ${file}: ${err.message}`);
        errCount++;
    }
}

console.log(`\nConcluído! Arquivos movidos: ${movedCount}, Erros: ${errCount}`);
