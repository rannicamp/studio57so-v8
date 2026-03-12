import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Inicializa as dependências com a mesma chave
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export async function POST(request) {
    let uploadedFileDetails = null;
    let tempFilePath = null;

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
        }

        // ─── PASSO 1: Salvar arquivo temporário no servidor (Node.js) ────────────
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Cria um nome de arquivo temporário seguro na pasta Temp do sistema
        tempFilePath = join(os.tmpdir(), `fatura_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`);
        writeFileSync(tempFilePath, buffer);
        console.log(`[GoogleAIFileManager] Arquivo temporário salvo em: ${tempFilePath}`);

        // ─── PASSO 2: Upload para o Google ───────────────────────────────────────
        console.log("[GoogleAIFileManager] Iniciando upload nativo do PDF para os servidores do Google...");
        uploadedFileDetails = await fileManager.uploadFile(tempFilePath, {
            mimeType: "application/pdf",
            displayName: file.name || "Fatura Cartao"
        });
        console.log(`[GoogleAIFileManager] Upload concluído! URI: ${uploadedFileDetails.file.uri}`);

        // ─── PASSO 3: Configuração do Modelo e Prompt ────────────────────────────
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Você é um assistente especializado em contabilidade e processamento de dados financeiros para o sistema "Studio 57".
Sua única função é analisar este PDF de fatura de cartão de crédito e extrair os dados em formato JSON estruturado.

🚫 REGRAS RÍGIDAS — O QUE IGNORAR (LIXO):
- IGNORE FORTEMENTE PAGAMENTOS DA FATURA: Qualquer linha indicando que a fatura foi paga deve ser DESCARTADA (ex: "PGTO DEBITO CONTA", "PAGAMENTO DE FATURA", "PGTO EM LOTERICA", "PAGAMENTO EFETUADO", "SALDO FATURA ANTERIOR", "PAGAMENTO TITULO"). Isso NÃO é uma receita, é a baixa da fatura anterior.
- IGNORE: Juros de Financiamento, Encargos, Multa, IOF, Limite de Crédito, Saldo Atual, Resumo da Fatura.
- IGNORE: Detalhamentos de limite e tabelas de parcelas pendentes (ex: "Parcela 02/05 a vencer"). 
- EXTRAIA APENAS: Compras, Serviços, Estornos e Transações reais efetivadas e cobradas NESTA fatura.

📅 TRATAMENTO DE DATA E TRANSAÇÕES ANTIGAS (MUITO IMPORTANTE):
- EXTRAIA TODAS AS COMPRAS da fatura, MESMO se a data da compra (data_transacao) for do mês anterior! É comum compras dos meses passados entrarem na fatura de fechamento. NÃO IGNORE transações dos meses anteriores se estiverem na aba de cobrança.
- Se a data na fatura for "DD/MM", deduza o ano correto. 
- Transações de Dezembro (12) em faturas pagas em Janeiro (01) devem usar o ANO ANTERIOR. 
- Formato final obrigatório: YYYY-MM-DD.

💰 TRATAMENTO DE VALOR (SINAIS E ESTORNOS):
- Na leitura do PDF (especialmente Banco do Brasil), COMPRAS geralmente aparecem SEM SINAL e ESTORNOS aparecem COM SINAL NEGATIVO (-). 
- INDEPENDENTE do PDF, no retorno JSON "valor" DEVE SER UM NÚMERO POSITIVO ESTUDIAL. 
- Você classificará o "tipo" baseado na natureza e no sinal do PDF:
  * "tipo": "Despesa" → Compras de produtos, iFood, Uber, assinaturas, supermercado, etc.
  * "tipo": "Receita" → ESTORNOS de compras, cancelamentos ou devoluções de dinheiro de lojas (normalmente marcados com - no PDF). NOTA: Lembre-se, o "PGTO DEBITO CONTA" da fatura deve ser TOTALMENTE IGNORADO, e não classificado como receita.
- Remova vírgulas de milhar e use ponto para decimais (1.500,50 → 1500.50).

🃏 CARTÕES MÚLTIPLOS E DEPENDENTES:
- Faturas frequentemente contêm compras do "Titular" e de "Cartões Adicionais". 
- Separe em objetos distintos se o cartão final FOR DIFERENTE.
- Associe cada lançamento rigorosamente ao titular e final de cartão correspondente na fatura.

Retorne EXCLUSIVAMENTE um Array JSON válido, SEM markdown, SEM texto extra, SEM blocos de código. Apenas o JSON puro.

A estrutura DEVE SER EXATAMENTE ESTA:
[
  {
    "cartao_final": "0753",
    "titular": "Igor M A Rezende",
    "bandeira": "Elo",
    "instituicao": "Banco do Brasil",
    "data_vencimento_fatura": "2026-02-10",
    "data_fechamento_fatura": "2026-01-07",
    "limite_credito": 5000.00,
    "lancamentos": [
      {
        "data_transacao": "2026-01-15",
        "descricao": "NOME DO ESTABELECIMENTO",
        "valor": 150.00,
        "tipo": "Despesa"
      }
    ]
  }
]`;

        // ─── PASSO 4: Envio e Geração de Conteúdo ────────────────────────────────
        console.log(`[GoogleAIFileManager] Chamando IA de visão espacial...`);
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadedFileDetails.file.mimeType,
                    fileUri: uploadedFileDetails.file.uri
                }
            },
            prompt
        ]);

        const responseText = await result.response.text();
        let cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const extratos = JSON.parse(cleanJson);

        return NextResponse.json({ success: true, extratos });

    } catch (error) {
        console.error('Erro no processamento da Fatura pelo Gemini Nativo:', error);
        return NextResponse.json(
            { error: 'Erro ao processar Fatura com a Inteligência Artificial.', details: error.message },
            { status: 500 }
        );
    } finally {
        // ─── PASSO 5: Limpeza da Casa ────────────────────────────────────────────
        // Deleta o arquivo temporário local
        if (tempFilePath) {
            try {
                unlinkSync(tempFilePath);
            } catch (err) {
                console.warn(`Aviso: falha ao deletar arquivo temporário local: ${tempFilePath}`, err.message);
            }
        }
        
        // Deleta o arquivo da nuvem do Google
        if (uploadedFileDetails && uploadedFileDetails.file && uploadedFileDetails.file.name) {
            try {
                console.log(`[GoogleAIFileManager] Limpando arquivo da nuvem: ${uploadedFileDetails.file.name}`);
                await fileManager.deleteFile(uploadedFileDetails.file.name);
                console.log(`[GoogleAIFileManager] Arquivo removido da nuvem com sucesso.`);
            } catch (err) {
                console.error(`Erro ao deletar arquivo dos servidores Google (${uploadedFileDetails.file.name}):`, err.message);
            }
        }
    }
}
