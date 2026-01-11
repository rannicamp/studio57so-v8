// app/api/financeiro/auditoria-ia/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const MODEL_NAME = "gemini-2.0-flash"; 

export async function POST(request) {
  try {
    // 1. Configurações Iniciais
    if (!genAI) return NextResponse.json({ error: "Chave GEMINI não configurada." }, { status: 500 });

    const supabase = await createClient(); 
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    // --- CORREÇÃO PRINCIPAL: BUSCA SEGURA DA ORGANIZAÇÃO ---
    // Não confiamos apenas no metadata, vamos na fonte (tabela usuarios)
    const { data: userProfile, error: userError } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();

    if (userError || !userProfile?.organizacao_id) {
        console.error("Erro ao buscar organização do usuário:", userError);
        return NextResponse.json({ error: "Usuário sem organização vinculada." }, { status: 400 });
    }

    const usuarioOrganizacaoId = userProfile.organizacao_id;
    // -------------------------------------------------------

    const { lancamentoId } = await request.json();

    // 2. Busca Lançamento e Anexos
    const { data: lancamento, error: lancamentoError } = await supabase
      .from('lancamentos')
      .select('*, anexos:lancamentos_anexos(*)')
      .eq('id', lancamentoId)
      // Garante que o lançamento pertence à mesma organização por segurança
      .eq('organizacao_id', usuarioOrganizacaoId) 
      .single();

    if (lancamentoError || !lancamento) {
        return NextResponse.json({ error: "Lançamento não encontrado ou acesso negado." }, { status: 404 });
    }

    if (!lancamento.anexos?.length) {
        return NextResponse.json({ message: "Sem anexos para auditar.", status: "Erro" });
    }

    // 3. Preparação do Prompt para o Gemini
    const promptParts = [];
    const filesToAudit = [];
    
    promptParts.push({
      text: `
        Você é um Auditor Contábil Sênior. Analise os documentos visuais anexos.
        
        DADOS ESPERADOS DO SISTEMA:
        - Valor: R$ ${lancamento.valor}
        - Data: ${lancamento.data_transacao}
        - Descrição: ${lancamento.descricao}

        ### REGRAS DE OURO PARA MÚLTIPLOS ARQUIVOS:
        1. **Redundância:** Se houver um BOLETO e um COMPROVANTE do mesmo pagamento, o valor NÃO SOMA. Considere apenas o valor efetivamente pago no comprovante.
        2. **Soma:** Se houver várias NOTAS FISCAIS ou RECIBOS diferentes (datas, números ou fornecedores diferentes), SOME os valores.
        3. **Divergência:** Se o valor do documento for diferente do sistema (mesmo que centavos), explique o motivo na análise.

        Retorne um JSON seguindo estritamente o schema fornecido.
      `
    });

    // Download e processamento dos anexos
    for (const anexo of lancamento.anexos) {
      const { data: fileBlob, error } = await supabase.storage.from('documentos-financeiro').download(anexo.caminho_arquivo);
      
      if (error) {
          console.error(`Erro download anexo ${anexo.id}:`, error);
          continue;
      }
      
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      promptParts.push({ 
          inlineData: { 
              mimeType: fileBlob.type, 
              data: buffer.toString('base64') 
          } 
      });
      filesToAudit.push(anexo.caminho_arquivo);
    }

    if (filesToAudit.length === 0) {
        return NextResponse.json({ error: "Nenhum arquivo pôde ser lido." }, { status: 500 });
    }

    // 4. Configuração do Schema de Resposta (JSON Estruturado)
    const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            valor_encontrado: { type: SchemaType.NUMBER, description: "Valor total identificado nos documentos." },
            confianca: { type: SchemaType.NUMBER, description: "Nível de confiança (0-100)." },
            analise_textual: { type: SchemaType.STRING, description: "Explicação detalhada do raciocínio da auditoria." },
            divergencia_encontrada: { type: SchemaType.BOOLEAN }
          },
          required: ["valor_encontrado", "confianca", "analise_textual", "divergencia_encontrada"],
        },
    };

    // 5. Chamada à IA
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig });
    const result = await model.generateContent(promptParts);
    const textResponse = result.response.text();
    
    let dadosIa;
    try {
        dadosIa = JSON.parse(textResponse);
    } catch (e) {
        console.error("Erro ao parsear JSON da IA:", textResponse);
        return NextResponse.json({ error: "A IA retornou um formato inválido." }, { status: 500 });
    }

    // 6. Lógica de Comparação e Status
    const valorSistema = parseFloat(lancamento.valor);
    const valorIa = parseFloat(dadosIa.valor_encontrado);
    const diferenca = Math.abs(valorSistema - valorIa);
    const TOLERANCIA = 0.05; // 5 centavos

    let statusAuditoria = 'Aprovado';
    
    if (isNaN(valorIa)) {
        statusAuditoria = 'Erro';
    } else if (diferenca > TOLERANCIA) {
        statusAuditoria = 'Divergente';
    }

    // 7. Gravação no Banco (Agora com ID da Organização Seguro)
    const logData = {
        lancamento_id: lancamentoId,
        organizacao_id: usuarioOrganizacaoId, // <--- Aqui está a correção garantida!
        status_auditoria: statusAuditoria,
        valor_identificado: valorIa,
        valor_lancamento: valorSistema,
        diferenca: diferenca,
        confianca_ia: dadosIa.confianca,
        analise_ia: dadosIa.analise_textual, 
        caminhos_arquivos: filesToAudit,
        modelo_ia: MODEL_NAME
    };

    const { error: logError } = await supabase
        .from('auditoria_ia_logs')
        .insert(logData);

    if (logError) {
        console.error("ERRO AO SALVAR LOG:", logError);
        return NextResponse.json({ error: "Erro de banco de dados: " + logError.message }, { status: 500 });
    }

    // 8. Atualiza o Status do Lançamento
    await supabase
        .from('lancamentos')
        .update({ status_auditoria_ia: statusAuditoria })
        .eq('id', lancamentoId);

    return NextResponse.json({ 
        success: true, 
        status: statusAuditoria, 
        analise: dadosIa 
    });

  } catch (error) {
    console.error("Erro Crítico Route:", error);
    return NextResponse.json({ error: error.message || "Erro interno no servidor." }, { status: 500 });
  }
}