require('dotenv').config({path: '.env.local'});
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

async function run() {
  try {
    console.log('Uploading to Gemini...');
    const uploadResult = await fileManager.uploadFile('A:/26_04_FAT_FATURA CARTÃO SICOOB CREDIRIODOCE - REF ABR26.pdf', {
      mimeType: 'application/pdf',
      displayName: 'Teste Fatura'
    });
    
    console.log('Upload successful. Generating content...');
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          description: "Lista de faturas e cartões extraídos do documento",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              cartao_final: { type: SchemaType.STRING, description: "Os últimos 4 dígitos numéricos do cartão" },
              titular: { type: SchemaType.STRING, description: "Nome do titular do cartão" },
              bandeira: { type: SchemaType.STRING, description: "Bandeira do cartão (ex: Elo, Visa)" },
              instituicao: { type: SchemaType.STRING, description: "Nome do Banco ou Instituição" },
              data_vencimento_fatura: { type: SchemaType.STRING, description: "Formato rígido YYYY-MM-DD" },
              data_fechamento_fatura: { type: SchemaType.STRING, description: "Formato rígido YYYY-MM-DD" },
              limite_credito: { type: SchemaType.NUMBER, description: "Valor do limite, em número positivo sem formatação monetária" },
              lancamentos: {
                type: SchemaType.ARRAY,
                description: "Todas as transações validadas",
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    data_transacao: { type: SchemaType.STRING, description: "Formato rígido YYYY-MM-DD" },
                    descricao: { type: SchemaType.STRING, description: "Nome do estabelecimento limpo" },
                    valor: { type: SchemaType.NUMBER, description: "Valor absoluto e sempre positivo, seja compra ou estorno" },
                    tipo: { type: SchemaType.STRING, enum: ["Despesa", "Receita"], description: "Despesa para compras, Receita para descontos/estornos" }
                  },
                  required: ["data_transacao", "descricao", "valor", "tipo"]
                }
              }
            },
            required: ["cartao_final", "titular", "data_vencimento_fatura", "lancamentos"]
          }
        }
      }
    });

    const prompt = `Você é um assistente especializado em contabilidade e processamento de dados financeiros para o sistema "Studio 57".
Sua única função é analisar ESTE PDF de uma fatura de cartão de crédito e extrair os dados. DEVOLVA APENAS OS DADOS SEGUINDO A ESTRUTURA DECLARADA.

🚫 REGRAS RÍGIDAS — O QUE IGNORAR (LIXO):
- INCLUIR PAGAMENTOS DA FATURA COMO RECEITA MINUCIOSAMENTE: O pagamento da fatura anterior DEVE OBRIGATORIAMENTE ser extraído e classificado como 'Receita'. Procure em todo o documento (inclusive dentro de quadros de Resumo Fatura) por linhas como ("PGTO DEBITO CONTA", "PAGAMENTO DE FATURA", "PGTO EM LOTERICA", "PGTO. TITULO", "PAGAMENTO EFETUADO"). Jamais omita o pagamento da fatura!
 - IGNORE: Juros de Financiamento, Encargos, Multa, IOF, Limite de Crédito, Saldo Atual, Mensagens Institucionais.
 - IGNORE: Detalhamentos de limite e tabelas parceladas. EXTRAIA APENAS compras e OBRIGATORIAMENTE o(s) pagamento(s) / baixa(s) desta fatura.

📅 TRATAMENTO DE DATA E TRANSAÇÕES ANTIGAS (MUITO IMPORTANTE):
- REGRA DE OURO PARA DATAS (EX: CAIXA): Jamais invente um ano futuro (ex: 2027) se não estiver expressamente escrito. Se a compra não tem ano, deduza pelo cabeçalho da fatura (ex: Vencimento "FEV26" pertence a 2026 e Janeiro a Fev26 pertencem a 2026).
- EXTRAIA TODAS AS COMPRAS da fatura, MESMO se a data da compra (data_transacao) for do mês anterior! É comum compras dos meses passados entrarem na fatura de fechamento. NÃO IGNORE transações dos meses anteriores se estiverem na aba de cobrança.
- Se a data na fatura for "DD/MM", deduza o ano correto seguindo a Regra de Ouro. - Transações de Dezembro (12) em faturas pagas em Janeiro (01) devem usar o ANO ANTERIOR. - Formato final obrigatório: YYYY-MM-DD. MANTENHA O FORMATO CORRETO.

💰 TRATAMENTO DE VALOR (SINAIS E ESTORNOS):
- Na leitura visual da Fatura (especialmente Banco do Brasil), COMPRAS geralmente aparecem SEM SINAL e ESTORNOS aparecem COM SINAL NEGATIVO (-). - INDEPENDENTE da Fatura, no retorno JSON "valor" DEVE SER UM NÚMERO POSITIVO. O valor absoluto. - Você classificará o "tipo" baseado na natureza e no sinal visual:
 * "tipo": "Despesa" → Compras de produtos, iFood, Uber, assinaturas, supermercado, etc.
 * "tipo": "Receita" → ESTORNOS de compras, cancelamentos ou devoluções de dinheiro de lojas (normalmente marcados com - no PDF).
- Remova vírgulas de milhar e use ponto para decimais (1.500,50 → 1500.50).

🃏 CARTÕES MÚLTIPLOS E DEPENDENTES:
- Faturas frequentemente contêm compras do "Titular" e de "Cartões Adicionais". - Separe em objetos distintos se o cartão final FOR DIFERENTE.
- Associe cada lançamento rigorosamente ao titular e final de cartão correspondente na fatura.
- ATENÇÃO: Se um cartão na fatura NÃO TEM NENHUM LANÇAMENTO ou zerado no detalhamento, NÃO RETORNE ELE DE MANEIRA ALGUMA. Retorne apenas cartões que possuírem compras validadas incluídas no array de "lancamentos".`;

    const result = await model.generateContent([
      { fileData: { mimeType: 'application/pdf', fileUri: uploadResult.file.uri } },
      prompt
    ]);

    const extratos = JSON.parse(result.response.text());
    console.log("============== RESULTADO ==============");
    console.log(JSON.stringify(extratos, null, 2));

  } catch (error) {
    console.error('Error during execution:', error);
  }
}

run();
