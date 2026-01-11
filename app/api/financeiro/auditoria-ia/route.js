// app/api/financeiro/auditoria-ia/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuração do Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Modelo 2.0 Flash (Padrão Studio 57)
const MODEL_NAME = "gemini-2.0-flash"; 

// Função auxiliar para esperar (delay)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    // 1. Verificações de Segurança e Auth
    if (!genAI) {
      return NextResponse.json({ error: "Chave GEMINI_API_KEY não configurada." }, { status: 500 });
    }

    const supabase = await createClient(); 
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const { lancamentoId } = await request.json();
    if (!lancamentoId) {
      return NextResponse.json({ error: "ID do lançamento é obrigatório." }, { status: 400 });
    }

    // 2. Buscar dados do lançamento e seus anexos
    const { data: lancamento, error: lancamentoError } = await supabase
      .from('lancamentos')
      .select(`
        *,
        anexos:lancamentos_anexos(*)
      `)
      .eq('id', lancamentoId)
      .single();

    if (lancamentoError || !lancamento) {
      return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    }

    if (!lancamento.anexos || lancamento.anexos.length === 0) {
      return NextResponse.json({ 
        message: "Lançamento sem anexos para auditar.",
        status: "Erro",
        detalhes: "Nenhum documento anexado."
      });
    }

    // 3. Preparar os arquivos para o Gemini (Vision)
    const promptParts = [];
    const filesToAudit = [];

    // Contexto de data para ajudar a IA
    const hoje = new Date();
    const dataContexto = `${hoje.getFullYear()}-${hoje.getMonth() + 1}-${hoje.getDate()}`;

    promptParts.push({
      text: `
        Você é um Auditor Financeiro Sênior da Studio 57.
        Sua tarefa é analisar a imagem/documento anexo e extrair o VALOR TOTAL FINAL da transação.
        DATA DE HOJE PARA CONTEXTO: ${dataContexto}
        
        Regras de Ouro:
        1. Procure por "Total", "Valor Total", "Total a Pagar", "Líquido".
        2. Se houver taxas de entrega ou descontos, considere o valor FINAL efetivamente pago.
        3. Se houver múltiplos documentos, some os totais de cada um.
        4. Retorne APENAS um objeto JSON puro, sem markdown, neste formato:
           {
             "valor_encontrado": 150.50,
             "confianca": 95,
             "moeda": "BRL",
             "data_documento": "2023-10-25" (se encontrar),
             "analise_textual": "Encontrei um recibo de Uber no valor de 25,90 e uma nota fiscal de restaurante de 124,60. A soma é 150,50."
           }
      `
    });

    for (const anexo of lancamento.anexos) {
      const { data: fileBlob, error: downloadError } = await supabase
        .storage
        .from('documentos-financeiro')
        .download(anexo.caminho_arquivo);

      if (downloadError) {
        console.error(`Erro ao baixar anexo ${anexo.nome_arquivo}:`, downloadError);
        continue; 
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      let mimeType = fileBlob.type;
      
      promptParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
      
      filesToAudit.push(anexo.caminho_arquivo);
    }

    if (filesToAudit.length === 0) {
        return NextResponse.json({ error: "Falha ao baixar os anexos do Storage." }, { status: 500 });
    }

    // 4. Enviar para o Gemini COM RETRY (Lógica de Re-tentativa para erro 429)
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    let result;
    let tentativas = 0;
    const maxTentativas = 3;

    while (tentativas < maxTentativas) {
        try {
            result = await model.generateContent(promptParts);
            break; // Se funcionou, sai do loop
        } catch (genError) {
            tentativas++;
            // Se for erro de quota (429) e ainda tivermos tentativas
            if (genError.message?.includes('429') && tentativas < maxTentativas) {
                console.warn(`[Gemini 429] Cota excedida. Tentativa ${tentativas}/${maxTentativas}. Aguardando 5s...`);
                await sleep(5000); // Espera 5 segundos antes de tentar de novo
            } else {
                throw genError; // Se for outro erro ou acabou as tentativas, explode o erro
            }
        }
    }

    const response = await result.response;
    const textResponse = response.text();

    const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let dadosIa;
    try {
        dadosIa = JSON.parse(jsonString);
    } catch (e) {
        console.error("Erro ao fazer parse do JSON da IA:", textResponse);
        // Tenta recuperar se a IA mandou texto antes do JSON
        const match = jsonString.match(/\{[\s\S]*\}/);
        if (match) {
             dadosIa = JSON.parse(match[0]);
        } else {
             throw new Error("A IA não retornou um JSON válido.");
        }
    }

    // 5. Comparação e Veredito
    const valorSistema = parseFloat(lancamento.valor);
    const valorIa = parseFloat(dadosIa.valor_encontrado);
    const diferenca = Math.abs(valorSistema - valorIa);
    const TOLERANCIA = 0.05; 
    
    let statusAuditoria = 'Erro';
    if (isNaN(valorIa)) {
        statusAuditoria = 'Erro';
        dadosIa.analise_textual = "A IA não conseguiu identificar um valor numérico válido.";
    } else if (diferenca <= TOLERANCIA) {
        statusAuditoria = 'Aprovado';
    } else {
        statusAuditoria = 'Divergente';
    }

    // 6. Persistência
    const { error: logError } = await supabase
        .from('auditoria_ia_logs')
        .insert({
            lancamento_id: lancamentoId,
            organizacao_id: user.organizacao_id,
            status_auditoria: statusAuditoria,
            valor_identificado: valorIa,
            valor_lancamento: valorSistema,
            diferenca: diferenca,
            confianca_ia: dadosIa.confianca,
            analise_ia: dadosIa.analise_textual,
            caminhos_arquivos: filesToAudit, 
            modelo_ia: MODEL_NAME
        });

    if (logError) console.error("Erro ao salvar log de auditoria:", logError);

    await supabase
        .from('lancamentos')
        .update({ status_auditoria_ia: statusAuditoria })
        .eq('id', lancamentoId);

    return NextResponse.json({
        success: true,
        status: statusAuditoria,
        analise: dadosIa,
        diferenca: diferenca
    });

  } catch (error) {
    console.error("Erro Crítico na Auditoria IA:", error);
    
    // Tratamento de erro amigável
    let msg = error.message || "Erro interno na auditoria.";
    
    if (msg.includes("429") || msg.includes("Too Many Requests")) {
        msg = "Limite de uso da IA atingido (Quota). Aguarde alguns segundos e tente novamente.";
    } else if (msg.includes("404") || msg.includes("not found")) {
        msg = `Modelo '${MODEL_NAME}' não encontrado. Verifique a chave de API ou a região.`;
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}