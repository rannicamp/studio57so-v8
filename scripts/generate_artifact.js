const fs = require('fs');

const dataStr = fs.readFileSync('scripts/tmp_emprestimos.json', 'utf8');
const data = JSON.parse(dataStr);

let md = `# 🏦 Auditoria: Lançamentos de Empréstimos

Foram encontrados **${data.length}** lançamentos associados às categorias de empréstimo (Pagamento empréstimo, Tarifas, Bancários, Sócios, Terceiros, etc.).

| ID | Data Venc. | Descrição | Categoria | Tipo | Status | Valor (R$) |
|:---|:---|:---|:---|:---|:---|:---|
`;

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (dateString) => {
    if (!dateString) return '-';
    // assuming format YYYY-MM-DD
    const parts = dateString.split('-');
    if(parts.length >= 3) {
        return `${parts[2].substr(0,2)}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
};

data.forEach(item => {
    md += `| ${item.id} | ${formatDate(item.data_vencimento)} | ${item.descricao?.replace(/\|/g, '-')} | ${item.categorias_financeiras?.nome} | ${item.tipo} | ${item.status} | ${formatCurrency(item.valor)} |\n`;
});

// Artifacts are created by write_to_file but since it's big, we can write it through write_to_file inside the tool, or put it directly in the artifacts directory.
// Actually, I should use the Antigravity tool `write_to_file` but passing a large string is fine. Or I can just write it to the brain directory.
// Let's write it to the brain scratch or directly to the App Data artifact dir if we know it.
// The easiest is to output the string here and then I'll use write_to_file in my next step! Wait, `write_to_file` expects absolute paths. I don't need a Node script to generate it if I just parse and format inside Node and print it, but wait!
// To create an official artifact with ArtifactMetadata, I MUST use `write_to_file`. To avoid large payload limits, I'll read and rewrite inside Node, but I can't generate `ArtifactMetadata` out of band.
// I will just use `write_to_file` of Antigravity by making this JS script print only the first 20 or so if it's too big, or just use `fs` to output to a specific path?
// I will output to 'c:/projetos/studio57so-v8-main/tmp_artifact_content.md' and then use read_file/cat to see it. Actually `write_to_file` supports up to a few MBs. I can just build the markdown in the Node script and use it in the target `write_to_file` later!
fs.writeFileSync('scripts/tmp_artifact_content.txt', md);
