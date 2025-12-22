import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// A biblioteca para ler PDFs será importada dinamicamente

// Força a rota a ser sempre dinâmica para evitar problemas em produção
export const dynamic = 'force-dynamic';

// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

// Função para dividir o texto em pedaços
function chunkText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

// --- FUNÇÃO PRINCIPAL DA ROTA ---
export async function POST(request) {
    const supabase = await createClient();
    try {
        const { anexoId } = await request.json();
        if (!anexoId) {
            return NextResponse.json({ error: 'ID do anexo é obrigatório.' }, { status: 400 });
        }

        console.log(`[PROCESS-ANEXO] Iniciando estudo para o anexo ID: ${anexoId}`);

        // 1. Buscar informações do anexo
        const { data: anexo, error: anexoError } = await supabase
            .from('empreendimento_anexos')
            .select('caminho_arquivo, empreendimento_id')
            .eq('id', anexoId)
            .single();

        if (anexoError || !anexo) throw new Error(`Anexo com ID ${anexoId} não encontrado.`);

        // 2. Baixar o arquivo do Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('empreendimento-anexos')
            .download(anexo.caminho_arquivo);

        if (downloadError) throw new Error(`Falha ao baixar o arquivo: ${downloadError.message}`);
        
        // 3. Extrair o texto do arquivo (LÓGICA REAL DE LEITURA)
        let text;
        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        
        if (fileData.type === 'application/pdf') {
            const pdf = (await import('pdf-parse')).default;
            const data = await pdf(fileBuffer);
            text = data.text;
        } else if (fileData.type.startsWith('text/')) {
            text = fileBuffer.toString('utf-8');
        } else {
            console.log(`[PROCESS-ANEXO] Anexo ${anexoId} não é um PDF ou texto, pulando estudo.`);
            return NextResponse.json({ success: true, message: 'Arquivo não é um documento de texto, aprendizado não aplicável.' });
        }
        
        if (!text || text.trim() === '') {
            console.log(`[PROCESS-ANEXO] Documento ${anexoId} está vazio ou não contém texto extraível.`);
             return NextResponse.json({ success: true, message: 'Documento vazio, nada para estudar.' });
        }

        const cleanedText = text.replace(/\s+/g, ' ').trim();
        const textChunks = chunkText(cleanedText);

        console.log(`[PROCESS-ANEXO] Documento dividido em ${textChunks.length} pedaços.`);

        // 4. Gerar os embeddings para cada pedaço
        const recordsToInsert = [];
        for (const chunk of textChunks) {
            const result = await embeddingModel.embedContent(chunk);
            const embedding = result.embedding.values;
            recordsToInsert.push({
                empreendimento_id: anexo.empreendimento_id,
                anexo_id: anexoId,
                content: chunk,
                embedding: embedding,
            });
        }
        
        // 5. Salvar na memória da Stella
        if (recordsToInsert.length > 0) {
            // Primeiro, remove qualquer memória antiga associada a este anexo
            await supabase.from('empreendimento_documento_embeddings').delete().eq('anexo_id', anexoId);
            // Agora, insere o novo conhecimento
            const { error: insertError } = await supabase.from('empreendimento_documento_embeddings').insert(recordsToInsert);
            if (insertError) throw insertError;
        }

        console.log(`[PROCESS-ANEXO] ${recordsToInsert.length} pedaços do documento foram memorizados com sucesso.`);
        return NextResponse.json({ success: true, message: `Documento estudado e ${recordsToInsert.length} pedaços de conhecimento foram memorizados.` });

    } catch (error) {
        console.error("[process-anexo] Erro fatal:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}