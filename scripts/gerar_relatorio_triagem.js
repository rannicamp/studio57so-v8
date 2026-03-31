const fs = require('fs');
const path = require('path');

const linhas = fs.readFileSync('C:\\temp_triagem_s57\\lista_arquivos_admin.txt', 'utf16le').split('\r\n');

// Vamos limpar e parsear as linhas (o PowerShell pode ter salvo com BOM ou espaços)
let arquivos = linhas.map(l => l.trim()).filter(l => l && !l.startsWith('FullName') && !l.startsWith('-'));

const categorias = {
    'Alterações Contratuais & Contrato Social': [],
    'Balanços Patrimoniais': [],
    'CNPJ & Certidões': [],
    'Geral / Administrativo': [],
    'Financeiro (Lixo a Ignorar)': [],
    'Outros (Potencial Lixo)': []
};

// Expressões regulares para triagem
const rxContrato = /contrato social|altera(c|ç)(a|ã)o|constitui/i;
const rxBalanco = /balan(c|ç)o|DRE|dre /i;
const rxCertidao = /certid(a|ã)o|cnd|cnpj|receita federal/i;
const rxFinanceiro = /nota fiscal|nf|fatura|boleto|comprovante|recibo|extrato|pagamento/i;

arquivos.forEach(arq => {
    const nome = path.basename(arq);
    if (rxFinanceiro.test(nome)) {
        categorias['Financeiro (Lixo a Ignorar)'].push(nome);
    } else if (rxContrato.test(nome)) {
        categorias['Alterações Contratuais & Contrato Social'].push(nome);
    } else if (rxBalanco.test(nome)) {
        categorias['Balanços Patrimoniais'].push(nome);
    } else if (rxCertidao.test(nome)) {
        categorias['CNPJ & Certidões'].push(nome);
    } else if (nome.toLowerCase().includes('alvar') || nome.toLowerCase().includes('licença')) {
        categorias['Geral / Administrativo'].push(nome);
    } else {
        categorias['Outros (Potencial Lixo)'].push(nome);
    }
});

let markdown = `# Relatório Pré-Triagem: S57 ADMINISTRATIVO\n\n`;
markdown += `Total de arquivos processados: ${arquivos.length}\n\n`;

for (let cat in categorias) {
    markdown += `## ${cat} (${categorias[cat].length} encontrados)\n`;
    if (categorias[cat].length > 0 && cat !== 'Outros (Potencial Lixo)' && cat !== 'Financeiro (Lixo a Ignorar)') {
       const amostra = categorias[cat].slice(0, 50); // Mostrar até 50
       amostra.forEach(arq => markdown += `- ${arq}\n`);
    } else if (cat === 'Outros (Potencial Lixo)' || cat === 'Financeiro (Lixo a Ignorar)') {
       markdown += `*(Mostrando apenas 10 como amostra)*\n`;
       const amostra = categorias[cat].slice(0, 10);
       amostra.forEach(arq => markdown += `- ${arq}\n`);
    }
    markdown += `\n`;
}

fs.writeFileSync('C:\\temp_triagem_s57\\relatorio_triagem.md', markdown, 'utf8');
console.log(`Relatório salvo com ${arquivos.length} arquivos analisados.`);
