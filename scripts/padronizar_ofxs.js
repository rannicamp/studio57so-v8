const fs = require('fs');
const path = require('path');

const dirPath = 'C:\\Projetos\\studio57so-v8\\OFX_COPIA_SEGURANCA';
const fileNames = fs.readdirSync(dirPath);

const pattern = /^\d{4}_\d{2}_\d{3,4}_([a-zA-Z0-9\-]+)(?:_\d+)?\.ofx$/i;

const DRY_RUN = false;

let renamedCount = 0;
let skippedCount = 0;
let errCount = 0;

let resultLog = [];

const memRenamed = new Set();
let existingNames = new Set(fileNames.map(f => f.toLowerCase()));

fileNames.forEach(f => memRenamed.add(f.toLowerCase()));

for (const file of fileNames) {
    if (!file.toLowerCase().endsWith('.ofx')) continue;

    const filePath = path.join(dirPath, file);

    if (pattern.test(file)) {
        skippedCount++;
        continue;
    }

    try {
        const content = fs.readFileSync(filePath, 'latin1');

        let year = '';
        let month = '';

        const dtstartMatch = content.match(/<DTSTART>(\d{8})/);
        const dtpostedMatch = content.match(/<DTPOSTED>(\d{8})/);

        let dt = null;
        if (dtpostedMatch) {
            dt = dtpostedMatch[1];
        } else if (dtstartMatch) {
            dt = dtstartMatch[1];
        }

        if (dt) {
            year = dt.substring(0, 4);
            month = dt.substring(4, 6);
        } else {
            const yearMatch = file.match(/20\d{2}/);
            if (yearMatch) year = yearMatch[0];
            const monthMatch = file.match(/(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i);
            const monthMap = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };
            if (monthMatch && monthMap[monthMatch[0].toLowerCase()]) {
                month = monthMap[monthMatch[0].toLowerCase()];
            }
        }

        if (!year || !month) {
            resultLog.push(`PULANDO (Sem data): ${file}`);
            errCount++;
            continue;
        }

        let bankId = '';
        const bankIdMatch = content.match(/<BANKID>(\d+)/);
        if (bankIdMatch) {
            bankId = bankIdMatch[1].padStart(3, '0');
        } else {
            resultLog.push(`PULANDO (Sem Banco): ${file}`);
            errCount++;
            continue;
        }

        let acctId = '';
        let acctIdMatch = content.match(/<ACCTID>([^<\r\n\s]+)/);
        if (acctIdMatch) {
            acctId = acctIdMatch[1].trim();
            acctId = acctId.replace(/[^a-zA-Z0-9\-]/g, '');
        } else {
            resultLog.push(`PULANDO (Sem Conta): ${file}`);
            errCount++;
            continue;
        }

        let baseNewName = `${year}_${month}_${bankId}_${acctId}`;
        let newName = `${baseNewName}.ofx`;
        let counter = 2;

        // Remove old name from checking if it matches the new one exactly
        let originalLower = file.toLowerCase();

        while ((memRenamed.has(newName.toLowerCase()) && newName.toLowerCase() !== originalLower) || (existingNames.has(newName.toLowerCase()) && newName.toLowerCase() !== originalLower)) {
            newName = `${baseNewName}_${counter}.ofx`;
            counter++;
        }

        if (newName.toLowerCase() === originalLower) {
            skippedCount++;
            continue;
        }

        memRenamed.add(newName.toLowerCase());

        resultLog.push(`RENOMEANDO: ${file} => ${newName}`);
        if (!DRY_RUN) {
            fs.renameSync(filePath, path.join(dirPath, newName));
        }
        renamedCount++;

    } catch (err) {
        resultLog.push(`ERRO em ${file}: ${err.message}`);
        errCount++;
    }
}

resultLog.push(`Concluído! Renomeados: ${renamedCount}, Ignorados (já no padrão): ${skippedCount}, Erros: ${errCount}`);
fs.writeFileSync(path.join(__dirname, 'preview.txt'), resultLog.join('\n'));
console.log('Finished. Check preview.txt');
