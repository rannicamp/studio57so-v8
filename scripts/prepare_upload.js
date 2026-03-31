const fs = require('fs');
const path = require('path');

const resultados = JSON.parse(fs.readFileSync('C:\\temp_triagem_s57\\resultados_analise_ia.json', 'utf8'));
const outDir = 'C:\\temp_triagem_s57\\PRONTOS_PARA_UPLOAD';

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Mapeamento de SIGLA gerada pela IA para o TIPO_DOCUMENTO_ID real do banco de dados
// CS=42 (Contrato Social), BP=44 (Balanço), CT=35 (Certidão), REQ=37 (Requerimento), CNPJ=36
const mapaCategorias = {
    'CS': { id: 42, prefixo: 'CONTRATO SOCIAL E ALTERAÇÕES' },
    'BP': { id: 44, prefixo: 'BALANÇO PATRIMONIAL DRE' },
    'CT': { id: 35, prefixo: 'CERTIDAO' },
    'REQ': { id: 37, prefixo: 'ALVARA REQUERIMENTO' },
};

const dadosBanco = [];

resultados.forEach(res => {
    if (res.pertence_incorporacao === true) {
        
        // Ajustar algumas nomenclaturas específicas
        let prefix = mapaCategorias[res.categoria_sigla] ? mapaCategorias[res.categoria_sigla].prefixo : res.categoria_sigla;
        let tipo_doc_id = mapaCategorias[res.categoria_sigla] ? mapaCategorias[res.categoria_sigla].id : 31; // 31 = OUTROS
        
        if (res.arquivo.toLowerCase().includes('cnpj')) {
            prefix = 'CARTAO CNPJ';
            tipo_doc_id = 36;
        }

        const dataStr = res.data_documento && res.data_documento.includes('/') ? res.data_documento.split('/').join('-') : res.data_documento;
        const dataSanitizada = dataStr ? ` - ${dataStr}` : '';
        
        let originalName = path.parse(res.arquivo).name.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 30).trim();

        // Nome Padrão Ouro: [PREFIXO] - STUDIO 57 INCORPORACOES LTDA - [DATA].pdf
        const novoNome = `${prefix} - STUDIO 57 INCORPORACOES LTDA - ${originalName}${dataSanitizada}.pdf`.toUpperCase();
        
        const caminhoDestino = path.join(outDir, novoNome);
        
        // Copiar o arquivo
        try {
            fs.copyFileSync(res.caminho_original, caminhoDestino);
            
            dadosBanco.push({
                empresa_id: 4, // 4 = STUDIO 57 INCORPORACOES LTDA
                tipo_documento_id: tipo_doc_id,
                nome_arquivo: novoNome,
                url_storage: `pre_upload/${novoNome}`,
                descricao: `Auditoria IA: ${res.justificativa}`
            });
            console.log(`✅ ${novoNome}`);
        } catch(e) {
            console.error(`Erro ao copiar ${res.arquivo}:`, e);
        }
    } else {
        console.log(`❌ IGNORADO (Não pertence / Rejeitado): ${res.arquivo}`);
    }
});

fs.writeFileSync(path.join(outDir, 'payload_banco.json'), JSON.stringify(dadosBanco, null, 2), 'utf8');
console.log(`\n\nForam renomeados e preparados ${dadosBanco.length} arquivos com sucesso para STUDIO 57 INCORPORAÇÕES LTDA.`);
