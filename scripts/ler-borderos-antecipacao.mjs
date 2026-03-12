/**
 * ler-borderos-antecipacao.mjs
 * 
 * Lê todos os PDFs borderôs de antecipação de recebíveis da pasta
 * EMPRÉSTIMOS/CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS
 * e gera um arquivo .txt organizado para cada um.
 * 
 * USO: node scripts/ler-borderos-antecipacao.mjs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Carrega o .env.local automaticamente (seguro — a chave NUNCA fica no código)
try {
    const dotenv = require('dotenv');
    dotenv.config({ path: '.env.local' });
} catch (e) { /* dotenv opcional em produção — variável já estará no ambiente */ }

// =====================================================
// CONFIGURAÇÃO
// =====================================================
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY não encontrada! Verifique seu .env.local');
    process.exit(1);
}
// gemini-2.5-flash: modelo mais atual, aceita PDF
const MODELO = "gemini-2.5-flash";
const MAX_RETRIES = 3; // Tentativas em caso de rate limit

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASTA_BORDEROS = path.resolve(
    __dirname,
    "..",
    "EMPRÉSTIMOS",
    "CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS"
);
const PASTA_SAIDA = path.resolve(
    __dirname,
    "..",
    "EMPRÉSTIMOS",
    "CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS",
    "TXT_EXTRAIDOS"
);

// =====================================================
// PROMPT DE EXTRAÇÃO
// =====================================================
const PROMPT_EXTRACAO = `
Você é um especialista em extração de dados de borderôs bancários de antecipação de recebíveis.

Analise este borderô de antecipação de recebíveis e extraia TODOS os dados disponíveis no documento.

Retorne as informações no seguinte formato estruturado (use exatamente estes campos):

=== BORDERÔ DE ANTECIPAÇÃO DE RECEBÍVEIS ===

DATA DA OPERAÇÃO: [data]
NÚMERO DA OPERAÇÃO: [número se houver]
INSTITUIÇÃO: [banco/cooperativa]
EMPRESA CEDENTE: [nome da empresa]
VALOR BRUTO TOTAL: [valor]
VALOR DAS TAXAS/JUROS: [valor se houver]
VALOR LÍQUIDO: [valor]
TAXA DE DESCONTO: [% se houver]
PRAZO MÉDIO: [dias se houver]

=== RECEBÍVEIS ANTECIPADOS ===

| # | Devedor/Favorecido | Nº Título/Boleto | Vencimento | Valor Face | Valor Presente |
|---|-------------------|-----------------|------------|------------|----------------|
[liste cada recebível em uma linha da tabela]

=== RESUMO ===
Quantidade de recebíveis: [qtd]
Valor total dos títulos: [valor]
Valor líquido creditado: [valor]
Conta de crédito: [número da conta se houver]

=== OBSERVAÇÕES ===
[Qualquer informação relevante que não se encaixe nos campos acima]

IMPORTANTE: Se algum campo não estiver no documento, escreva "Não informado". Não invente dados.
`;

// =====================================================
// FUNÇÕES
// =====================================================

async function esperarSegundos(segundos) {
    return new Promise((resolve) => setTimeout(resolve, segundos * 1000));
}

function extrairEsperaDoErro(mensagemErro) {
    const match = mensagemErro.match(/retry in (\d+)[\.\d]*s/i);
    if (match) return parseInt(match[1]) + 10;
    return 70;
}

async function uploadArquivoREST(caminhoArquivo, nomeExibicao) {
    const fileBytes = fs.readFileSync(caminhoArquivo);
    const fileSize = fileBytes.length;

    // Passo 1: Inicia o upload resumível
    const initResp = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${API_KEY}`,
        {
            method: "POST",
            headers: {
                "X-Goog-Upload-Protocol": "resumable",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Header-Content-Length": fileSize,
                "X-Goog-Upload-Header-Content-Type": "application/pdf",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ file: { display_name: nomeExibicao } }),
        }
    );
    const uploadUrl = initResp.headers.get("x-goog-upload-url");
    if (!uploadUrl) throw new Error("Falha ao obter URL de upload");

    // Passo 2: Envia o arquivo
    const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "Content-Length": fileSize,
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
        },
        body: fileBytes,
    });
    const uploadData = await uploadResp.json();
    if (!uploadData.file?.uri) throw new Error(`Falha no upload: ${JSON.stringify(uploadData)}`);
    return uploadData.file;
}

async function gerarConteudoREST(fileUri, fileMimeType, tentativa = 0) {
    const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { file_data: { mime_type: fileMimeType, file_uri: fileUri } },
                        { text: PROMPT_EXTRACAO }
                    ]
                }]
            }),
        }
    );
    const data = await resp.json();

    if (!resp.ok) {
        const errMsg = data.error?.message || JSON.stringify(data);
        if (resp.status === 429 && tentativa < MAX_RETRIES) {
            const espera = extrairEsperaDoErro(errMsg);
            console.log(`   ⚠️  Rate limit (tentativa ${tentativa + 1}/${MAX_RETRIES}). Aguardando ${espera}s...`);
            await esperarSegundos(espera);
            return gerarConteudoREST(fileUri, fileMimeType, tentativa + 1);
        }
        throw new Error(errMsg);
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta da IA";
}

async function deletarArquivoREST(fileName) {
    try {
        await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${API_KEY}`,
            { method: "DELETE" }
        );
    } catch (e) { /* ignora */ }
}

async function lerBordero(caminhoArquivo, nomeArquivo) {
    console.log(`\n📄 Processando: ${nomeArquivo}`);
    console.log("   ⬆️  Fazendo upload para o Gemini...");

    const arquivo = await uploadArquivoREST(caminhoArquivo, nomeArquivo);
    console.log(`   ✅ Upload concluído! URI: ${arquivo.uri.slice(-30)}...`);
    await esperarSegundos(3);

    const texto = await gerarConteudoREST(arquivo.uri, arquivo.mimeType || "application/pdf");
    await deletarArquivoREST(arquivo.name);
    return texto;
}

async function processarTodosBorderos() {
    console.log("🚀 ROBÔ LEITOR DE BORDERÔS DE ANTECIPAÇÃO");
    console.log("==========================================");
    console.log(`📁 Pasta de entrada: ${PASTA_BORDEROS}`);
    console.log(`📁 Pasta de saída: ${PASTA_SAIDA}`);

    // Cria pasta de saída se não existir
    if (!fs.existsSync(PASTA_SAIDA)) {
        fs.mkdirSync(PASTA_SAIDA, { recursive: true });
        console.log("   ✅ Pasta TXT_EXTRAIDOS criada.");
    }

    // Lista todos os PDFs na pasta
    const arquivos = fs
        .readdirSync(PASTA_BORDEROS)
        .filter((f) => f.toLowerCase().endsWith(".pdf"))
        .sort();

    if (arquivos.length === 0) {
        console.log("❌ Nenhum PDF encontrado na pasta!");
        return;
    }

    console.log(`\n📋 Encontrados ${arquivos.length} borderôs para processar:\n`);
    arquivos.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));

    // Arquivo de resumo consolidado
    const linhasResumo = [
        "RESUMO CONSOLIDADO - BORDERÔS DE ANTECIPAÇÃO DE RECEBÍVEIS",
        "=".repeat(60),
        `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
        `Total de borderôs: ${arquivos.length}`,
        "=".repeat(60),
        "",
    ];

    const erros = [];
    let processados = 0;

    for (const nomeArquivo of arquivos) {
        const caminhoArquivo = path.join(PASTA_BORDEROS, nomeArquivo);
        const nomeSemExtensao = nomeArquivo.replace(/\.pdf$/i, "");
        const caminhoSaida = path.join(PASTA_SAIDA, `${nomeSemExtensao}.txt`);

        // Pula se já foi extraído
        if (fs.existsSync(caminhoSaida)) {
            console.log(`\n⏭️  Já processado: ${nomeArquivo} (TXT existe). Pulando...`);
            processados++;
            continue;
        }

        try {
            const textoExtraido = await lerBordero(caminhoArquivo, nomeArquivo);

            // Cabeçalho do arquivo TXT
            const conteudoFinal = [
                `ARQUIVO ORIGINAL: ${nomeArquivo}`,
                `EXTRAÍDO EM: ${new Date().toLocaleString("pt-BR")}`,
                "=".repeat(60),
                "",
                textoExtraido,
            ].join("\n");

            fs.writeFileSync(caminhoSaida, conteudoFinal, "utf8");
            console.log(`   💾 TXT salvo: ${nomeSemExtensao}.txt`);

            linhasResumo.push(`✅ ${nomeArquivo}`);
            processados++;

            // Pausa entre requisições para não sobrecarregar a API
            if (arquivos.indexOf(nomeArquivo) < arquivos.length - 1) {
                console.log("   ⏳ Aguardando 5s antes do próximo...");
                await esperarSegundos(5);
            }
        } catch (erro) {
            console.error(`   ❌ ERRO ao processar ${nomeArquivo}:`, erro.message);
            erros.push({ arquivo: nomeArquivo, erro: erro.message });
            linhasResumo.push(`❌ ${nomeArquivo} — ERRO: ${erro.message}`);
        }
    }

    // Salva arquivo de resumo
    linhasResumo.push("");
    linhasResumo.push(`Total processados com sucesso: ${processados}/${arquivos.length}`);
    if (erros.length > 0) {
        linhasResumo.push(`Total de erros: ${erros.length}`);
    }

    const caminhoResumo = path.join(PASTA_SAIDA, "_RESUMO_GERAL.txt");
    fs.writeFileSync(caminhoResumo, linhasResumo.join("\n"), "utf8");

    // Resultado final
    console.log("\n==========================================");
    console.log(`✅ CONCLUÍDO! ${processados}/${arquivos.length} borderôs processados.`);
    if (erros.length > 0) {
        console.log(`⚠️  ${erros.length} erro(s):`);
        erros.forEach((e) => console.log(`   - ${e.arquivo}: ${e.erro}`));
    }
    console.log(`📄 Resumo geral salvo em: _RESUMO_GERAL.txt`);
    console.log(`📁 Arquivos TXT em: ${PASTA_SAIDA}`);
}

// Executa!
processarTodosBorderos().catch(console.error);
