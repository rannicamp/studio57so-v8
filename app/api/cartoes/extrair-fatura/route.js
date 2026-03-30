import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
        const { arquivoId, arquivoUrl, organizacaoId, contaSelecionadaId, usuarioId } = body;

        if (!arquivoId || !arquivoUrl || !organizacaoId) {
            return NextResponse.json({ error: 'Dados insuficientes fornecidos.' }, { status: 400 });
        }

        // ─── PASSO 1: FIRE AND FORGET (Desacoplamento Assíncrono) ────────────
        // Iniciamos a rotina pesada sem esperar que ela termine
        processarFaturaBackground({ arquivoId, arquivoUrl, organizacaoId, contaSelecionadaId, usuarioId })
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
async function processarFaturaBackground({ arquivoId, arquivoUrl, organizacaoId, contaSelecionadaId, usuarioId }) {
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
        console.log(`[FaturaBackground] Chamando Modelo Gemini 2.5 Flash...`);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Você é um assistente especializado em contabilidade e processamento de dados financeiros para o sistema "Studio 57".
Sua única função é analisar ESTE PDF de uma fatura de cartão de crédito e extrair os dados em formato JSON estruturado.

🚫 REGRAS RÍGIDAS — O QUE IGNORAR (LIXO):
- IGNORE FORTEMENTE PAGAMENTOS DA FATURA: Qualquer linha indicando que a fatura foi paga deve ser DESCARTADA (ex: "PGTO DEBITO CONTA", "PAGAMENTO DE FATURA", "PGTO EM LOTERICA", "PAGAMENTO EFETUADO", "SALDO FATURA ANTERIOR", "PAGAMENTO TITULO"). Isso NÃO é uma receita, é a baixa da fatura anterior.
- IGNORE: Juros de Financiamento, Encargos, Multa, IOF, Limite de Crédito, Saldo Atual, Resumo da Fatura.
- IGNORE: Detalhamentos de limite e tabelas de parcelas pendentes (ex: "Parcela 02/05 a vencer"). 
- EXTRAIA APENAS: Compras, Serviços, Estornos e Transações reais efetivadas e cobradas NESTA fatura.

📅 TRATAMENTO DE DATA E TRANSAÇÕES ANTIGAS (MUITO IMPORTANTE):
- REGRA DE OURO PARA DATAS (EX: CAIXA): Jamais invente um ano futuro (ex: 2027) se não estiver expressamente escrito. Se a compra não tem ano, deduza pelo cabeçalho da fatura (ex: Vencimento "FEV26" pertence a 2026 e Janeiro a Fev26 pertencem a 2026).
- EXTRAIA TODAS AS COMPRAS da fatura, MESMO se a data da compra (data_transacao) for do mês anterior! É comum compras dos meses passados entrarem na fatura de fechamento. NÃO IGNORE transações dos meses anteriores se estiverem na aba de cobrança.
- Se a data na fatura for "DD/MM", deduza o ano correto seguindo a Regra de Ouro. 
- Transações de Dezembro (12) em faturas pagas em Janeiro (01) devem usar o ANO ANTERIOR. 
- Formato final obrigatório: YYYY-MM-DD. MANTENHA O FORMATO CORRETO.

💰 TRATAMENTO DE VALOR (SINAIS E ESTORNOS):
- Na leitura visual da Fatura (especialmente Banco do Brasil), COMPRAS geralmente aparecem SEM SINAL e ESTORNOS aparecem COM SINAL NEGATIVO (-). 
- INDEPENDENTE da Fatura, no retorno JSON "valor" DEVE SER UM NÚMERO POSITIVO. O valor absoluto. 
- Você classificará o "tipo" baseado na natureza e no sinal visual:
  * "tipo": "Despesa" → Compras de produtos, iFood, Uber, assinaturas, supermercado, etc.
  * "tipo": "Receita" → ESTORNOS de compras, cancelamentos ou devoluções de dinheiro de lojas (normalmente marcados com - no PDF).
- Remova vírgulas de milhar e use ponto para decimais (1.500,50 → 1500.50).

🃏 CARTÕES MÚLTIPLOS E DEPENDENTES:
- Faturas frequentemente contêm compras do "Titular" e de "Cartões Adicionais". 
- Separe em objetos distintos se o cartão final FOR DIFERENTE.
- Associe cada lançamento rigorosamente ao titular e final de cartão correspondente na fatura.
- ATENÇÃO: Se um cartão na fatura NÃO TEM NENHUM LANÇAMENTO ou zerado no detalhamento, NÃO RETORNE ELE DE MANEIRA ALGUMA. Retorne apenas cartões listados no JSON que possuírem compras validadas incluídas no array de "lancamentos".

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

        const result = await model.generateContent([
            { fileData: { mimeType: 'application/pdf', fileUri: geminiFileUri } },
            prompt
        ]);

        const responseText = await result.response.text();
        let cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const extratos = JSON.parse(cleanJson);

        if (!extratos || extratos.length === 0) {
            throw new Error("A IA não encontrou nenhum lançamento válido na fatura.");
        }

        console.log(`[FaturaBackground] JSON extraído com sucesso. Contém ${extratos.length} cartão(ões).`);

        // ─── ETAPA C: Processar DB Supabase (O Trabalho Centralizado) ────────────
        let totalEnviados = 0;
        let primeiroVencimento = null;

        // Recupera o arquivo original para clonagem (se a fatura tiver múltiplos cartões)
        const { data: originalArq } = await supabaseAdmin.from('banco_arquivos_ofx')
            .select('*').eq('id', arquivoId).single();

        for (let eIndex = 0; eIndex < extratos.length; eIndex++) {
            const extrato = extratos[eIndex];
            if (!extrato.lancamentos || extrato.lancamentos.length === 0) continue;

            const finalDigits = extrato.cartao_final ? String(extrato.cartao_final).trim() : '';
            let matchedContaId = contaSelecionadaId;

            // Tentativa de Roteamento de Cartões Dependentes
            if (finalDigits.length >= 4) {
                const { data: contaExistente } = await supabaseAdmin.from('contas_financeiras')
                    .select('id').eq('organizacao_id', organizacaoId)
                    .ilike('numero_conta', `%${finalDigits}%`).limit(1).single();
                
                if (contaExistente) {
                    matchedContaId = contaExistente.id;
                } else {
                    // Auto Criar Cartão
                    const nomeContaIA = `⚠️ Cartão Final ${finalDigits} - ${extrato.titular || 'Titular IA'}`;
                    const dFechamento = extrato.data_fechamento_fatura ? parseInt(extrato.data_fechamento_fatura.split('-')[2]) : null;
                    const dPagamento = extrato.data_vencimento_fatura ? parseInt(extrato.data_vencimento_fatura.split('-')[2]) : null;

                    const { data: novaConta } = await supabaseAdmin.from('contas_financeiras').insert({
                        nome: nomeContaIA, tipo: 'Cartão de Crédito', numero_conta: finalDigits,
                        instituicao: extrato.instituicao || extrato.bandeira || null,
                        dia_fechamento_fatura: dFechamento, dia_pagamento_fatura: dPagamento,
                        limite_credito: extrato.limite_credito || null, saldo_inicial: 0, organizacao_id: organizacaoId,
                    }).select('id').single();

                    if (novaConta) matchedContaId = novaConta.id;
                }
            }

            const dataVencimentoIA = extrato.data_vencimento_fatura || new Date().toISOString().split('T')[0];
            if (!primeiroVencimento) primeiroVencimento = dataVencimentoIA;

            // Criar Fatura (se não existir, cria a casca batendo o mês)
            const mesRef = dataVencimentoIA.substring(0, 7);
            await supabaseAdmin.from('faturas_cartao').upsert({
                conta_id: Number(matchedContaId), organizacao_id: organizacaoId, mes_referencia: mesRef,
                data_vencimento: dataVencimentoIA, data_fechamento: extrato.data_fechamento_fatura || dataVencimentoIA, status: 'Fechada'
            }, { onConflict: 'conta_id,mes_referencia', ignoreDuplicates: true });

            // GERENCIAMENTO DO ARQUIVO CABEÇALHO (Vínculo Visual na UI)
            let useArqId = arquivoId;
            if (eIndex === 0) {
                // O primeiro cartão atualiza o arquivo base que o usuário subiu
                await supabaseAdmin.from('banco_arquivos_ofx').update({
                    conta_id: Number(matchedContaId),
                    status: 'Processado IA',
                    periodo_inicio: dataVencimentoIA,
                    periodo_fim: dataVencimentoIA
                }).eq('id', arquivoId);
            } else if (originalArq) {
                // IA achou cartões extras no mesmo PDF. Cria um clone da "capa" na UI.
                const { data: arqClone } = await supabaseAdmin.from('banco_arquivos_ofx').insert({
                    organizacao_id: organizacaoId,
                    conta_id: Number(matchedContaId),
                    nome_arquivo: originalArq.nome_arquivo,
                    status: 'Processado IA',
                    periodo_inicio: dataVencimentoIA,
                    periodo_fim: dataVencimentoIA,
                    arquivo_url: originalArq.arquivo_url
                }).select('id').single();
                if (arqClone) useArqId = arqClone.id;
            }

            // Preparar Transações com MD5 Hashing Robusto Anti-Duplicata
            const payloadTransacoes = extrato.lancamentos.map((l, index) => {
                const dataTrans = l.data_transacao || dataVencimentoIA;
                const tipoLetra = l.tipo === 'Despesa' ? 'D' : 'R';
                const baseHashText = `${finalDigits}-${dataTrans}-${l.valor}-${tipoLetra}-${index}`;
                const robustHash = crypto.createHash('md5').update(baseHashText).digest('hex').substring(0, 16);
                
                const fitidFormatado = `CC-${finalDigits || '00'}-${robustHash}`;

                return {
                    fitid: fitidFormatado, arquivo_id: useArqId, organizacao_id: organizacaoId, conta_id: matchedContaId,
                    data_transacao: dataTrans, valor: l.tipo === 'Despesa' ? -Math.abs(l.valor) : Math.abs(l.valor),
                    tipo: l.tipo, descricao_banco: l.descricao || 'Compra Cartão', memo_banco: `Fatura IA: ${extrato.titular || 'Titular'}`
                };
            });

            if (payloadTransacoes.length > 0) {
                const { error } = await supabaseAdmin.from('banco_transacoes_ofx').upsert(payloadTransacoes, { onConflict: 'fitid' });
                if(!error) totalEnviados += payloadTransacoes.length;
            }
        }
        
        console.log(`[FaturaBackground] Sucesso Total! ${totalEnviados} transações processadas.`);

        if (usuarioId) {
            await enviarNotificacao({ 
                userId: usuarioId, 
                titulo: 'Fatura Lida com Sucesso! 🤖', 
                mensagem: `A IA extraiu ${totalEnviados} lançamentos e eles já estão no seu painel.`, 
                link: '/financeiro', 
                tipo: 'financeiro', 
                organizacaoId, 
                supabaseClient: supabaseAdmin 
            });
        }

    } catch (err) {
        console.error(`[FaturaBackground] Ocorreu um erro no processamento do arquivo ${arquivoId}:`, err);
        await supabaseAdmin.from('banco_arquivos_ofx').update({
            status: 'Falha Leitura'
        }).eq('id', arquivoId);

        if (usuarioId) {
            await enviarNotificacao({ 
                userId: usuarioId, 
                titulo: 'Falha ao processar Fatura 🚨', 
                mensagem: `A IA não conseguiu ler o PDF: ${err.message || 'Arquivo ilegível'}.`, 
                link: '/financeiro', 
                tipo: 'financeiro', 
                organizacaoId, 
                supabaseClient: supabaseAdmin 
            });
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
