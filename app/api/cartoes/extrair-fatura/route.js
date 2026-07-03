import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import crypto from 'crypto';
import { enviarNotificacao } from '@/utils/notificacoes';

// Força ambiente Node.js para suportar o fs e módulos nativos
export const runtime = 'nodejs';
// Na versão Vercel/Netlify Pro estende a duração da função principal, por garantia.
export const maxDuration = 60;
const supabaseAdmin = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY
);

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export async function POST(request) {
 try {
 const body = await request.json();
 const { arquivoId, arquivoUrl, organizacaoId, contaSelecionadaId, usuarioId, faturaSelecionadaVencimento } = body;

 if (!arquivoId || !arquivoUrl || !organizacaoId) {
 return NextResponse.json({ error: 'Dados insuficientes fornecidos.' }, { status: 400 });
 }

 // ─── PASSO 1: FIRE AND FORGET (Desacoplamento Assíncrono) ────────────
 // Iniciamos a rotina pesada sem esperar que ela termine
 processarFaturaBackground({ arquivoId, arquivoUrl, organizacaoId, contaSelecionadaId, usuarioId, faturaSelecionadaVencimento })
 .catch(err => console.error(`[FaturaBackground] Falha fatal no worker para arquivo ${arquivoId}:`, err));

 // ─── PASSO 2: RETORNAR RESPOSTA IMEDIATA (202 Accepted) ────────────
 return NextResponse.json({ success: true, message: 'Processamento enviado para a fila (Background).' }, { status: 202 });

 } catch (error) {
 console.error('Erro na chamada inicial da API de Fatura:', error);
 return NextResponse.json({ error: 'Falha ao iniciar processamento da fatura.' }, { status: 500 });
 }
}

// =========================================================================
// WORKER DE BACKGROUND (Roda de forma assíncrona aliviando a interface)
// =========================================================================
async function processarFaturaBackground({ arquivoId, arquivoUrl, organizacaoId, contaSelecionadaId, usuarioId, faturaSelecionadaVencimento }) {
 console.log(`[FaturaBackground] Iniciando processamento do arquivo ${arquivoId}`);
 let geminiFileUri = null;
 let geminiFileName = null;
 try {
 // Atualiza banco para garantir status em "Processando..."
 await supabaseAdmin.from('banco_arquivos_ofx').update({ status: 'Processando...' }).eq('id', arquivoId);

 // ─── ETAPA A: Download do PDF e Upload para GEMINI FILE API ────────────
 console.log(`[FaturaBackground] Fazendo download temporário do PDF...`);
 const pdfResponse = await fetch(arquivoUrl);
 if (!pdfResponse.ok) throw new Error("Não foi possível acessar a URL do PDF no Storage.");
 const arrayBuffer = await pdfResponse.arrayBuffer();
 const buffer = Buffer.from(arrayBuffer);
 const os = require('os');
 const path = require('path');
 const fs = require('fs');
 const tempFilePath = path.join(os.tmpdir(), `fatura_${arquivoId}.pdf`);
 fs.writeFileSync(tempFilePath, buffer);

 console.log(`[FaturaBackground] PDF salvo no /tmp. Fazendo upload para Google File API...`);
 const uploadResult = await fileManager.uploadFile(tempFilePath, {
 mimeType: "application/pdf",
 displayName: `Fatura_${arquivoId}`,
 });
 geminiFileUri = uploadResult.file.uri;
 geminiFileName = uploadResult.file.name;
 // Limpa o tmp
 try { fs.unlinkSync(tempFilePath); } catch(e){}

 // ─── ETAPA B: Geração do Conteúdo IA ────────────
 console.log(`[FaturaBackground] Chamando Modelo Gemini 3.1 Pro Preview...`);
  
 const generationConfig = {
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
           description: "Todas as transações validadas pertencentes a este cartão nesta fatura",
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
 };

 const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview', generationConfig });

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
 { fileData: { mimeType: 'application/pdf', fileUri: geminiFileUri } },
 prompt
 ]);

 const extratos = JSON.parse(result.response.text());

 if (!extratos || extratos.length === 0) {
 throw new Error("A IA não encontrou nenhum lançamento válido na fatura.");
 }

 console.log(`[FaturaBackground] JSON extraído com sucesso. Contém ${extratos.length} cartão(ões).`);

 // ─── ETAPA C: Processar DB Supabase (Centralização Forte na Fatura Atual) ────────────
 let totalEnviados = 0;

 const matchedContaId = Number(contaSelecionadaId);
 const dataVencimentoReal = faturaSelecionadaVencimento || extratos[0]?.data_vencimento_fatura || new Date().toISOString().split('T')[0];

 // 1. Atualizar o CABEÇALHO do Arquivo único enviado
 await supabaseAdmin.from('banco_arquivos_ofx').update({
 conta_id: matchedContaId,
 status: 'Processado IA',
 periodo_inicio: dataVencimentoReal,
 periodo_fim: dataVencimentoReal
 }).eq('id', arquivoId);

 // 2. Achatamento (Flatten) de todos os cartões num array único
 const allLancamentosToProcess = [];
 extratos.forEach((extrato) => {
 if (!extrato.lancamentos || extrato.lancamentos.length === 0) return;
 const finalDigits = extrato.cartao_final ? String(extrato.cartao_final).trim() : '';
 extrato.lancamentos.forEach((l) => {
 allLancamentosToProcess.push({
 finalDigits,
 titular: extrato.titular,
 ...l
 });
 });
 });

 // 3. Preparar Transações com Hashing Robusto Anti-Duplicata
 const payloadTransacoes = allLancamentosToProcess.map((l, index) => {
 const dataTrans = l.data_transacao || dataVencimentoReal;
 const tipoLetra = l.tipo === 'Despesa' ? 'D' : 'R';
 const baseHashText = `${l.finalDigits}-${dataTrans}-${l.valor}-${tipoLetra}-${index}`;
 const robustHash = crypto.createHash('md5').update(baseHashText).digest('hex').substring(0, 16);
 const fitidFormatado = `CC-${l.finalDigits || '00'}-${robustHash}`;

 return {
 fitid: fitidFormatado, arquivo_id: arquivoId, organizacao_id: organizacaoId, conta_id: matchedContaId,
 data_transacao: dataTrans, valor: l.tipo === 'Despesa' ? -Math.abs(l.valor) : Math.abs(l.valor),
 tipo: l.tipo, descricao_banco: l.descricao || 'Compra Cartão', memo_banco: `Cartão ${l.finalDigits} (${l.titular || 'Adicional'})`
 };
 });

 // 4. Insert Massivo na Conta Unificada
 if (payloadTransacoes.length > 0) {
 const { error } = await supabaseAdmin.from('banco_transacoes_ofx').upsert(payloadTransacoes, { onConflict: 'fitid' });
 if (!error) totalEnviados = payloadTransacoes.length;
 else console.error("[FaturaBackground] Erro Upsert:", error);
 }
 console.log(`[FaturaBackground] Sucesso Total! ${totalEnviados} transações processadas.`);

 if (usuarioId) {
 await enviarNotificacao({ userId: usuarioId, titulo: 'Fatura Lida com Sucesso! 🤖', mensagem: `A IA extraiu ${totalEnviados} lançamentos e eles já estão no seu painel.`, link: '/financeiro', tipo: 'financeiro', organizacaoId, supabaseClient: supabaseAdmin });
 }

 } catch (err) {
 console.error(`[FaturaBackground] Ocorreu um erro no processamento do arquivo ${arquivoId}:`, err);
 await supabaseAdmin.from('banco_arquivos_ofx').update({
 status: 'Falha Leitura'
 }).eq('id', arquivoId);

 if (usuarioId) {
 await enviarNotificacao({ userId: usuarioId, titulo: 'Falha ao processar Fatura 🚨', mensagem: `A IA não conseguiu ler o PDF: ${err.message || 'Arquivo ilegível'}.`, link: '/financeiro', tipo: 'financeiro', organizacaoId, supabaseClient: supabaseAdmin });
 }
 } finally {
 // Exclusão do arquivo da nuvem da Gemini
    if (geminiFileName) {
 try {
 await fileManager.deleteFile(geminiFileName);
 console.log(`[FaturaBackground] Lixo limpo: Arquivo do Gemini apagado (${geminiFileName}).`);
 } catch(e) {
 console.error("Falha ao apagar arquivo no Gemini:", e);
 }
 }
 }
}
