import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
// A linha 'import pdf from 'pdf-parse';' foi removida daqui.

// Adicionamos esta linha para forçar o Next.js a tratar esta rota como dinâmica.
// Isso ajuda a resolver problemas de build em ambientes como a Netlify.
export const dynamic = 'force-dynamic';

// --- Inicialização dos Serviços ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

// Função para dividir o texto em pedaços menores para a IA conseguir processar
function chunkText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

// --- Função Principal da Rota ---
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { anexoId } = await request.json();
        if (!anexoId) {
            return new NextResponse(JSON.stringify({ error: 'ID do anexo é obrigatório.' }), { status: 400 });
        }

        // 1. Buscar informações do anexo no banco de dados
        const { data: anexo, error: anexoError } = await supabase
            .from('empreendimento_anexos')
            .select('caminho_arquivo, empreendimento_id, nome_arquivo')
            .eq('id', anexoId)
            .single();

        if (anexoError || !anexo) {
            throw new Error(`Anexo com ID ${anexoId} não encontrado.`);
        }

        // 2. Baixar o arquivo do Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('empreendimento-anexos')
            .download(anexo.caminho_arquivo);

        if (downloadError) {
            throw new Error(`Falha ao baixar o arquivo: ${downloadError.message}`);
        }
        
        // 3. Extrair o texto do arquivo
        let text;
        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        
        if (fileData.type === 'application/pdf') {
            // ***** MUDANÇA PRINCIPAL AQUI *****
            // Importamos o 'pdf-parse' dinamicamente, só quando precisamos dele.
            const pdf = (await import('pdf-parse')).default;
            const data = await pdf(fileBuffer);
            text = data.text;
        } else if (fileData.type.startsWith('text/')) {
            text = fileBuffer.toString('utf-8');
        } else {
            // Se não for PDF ou texto, não podemos processar.
            return NextResponse.json({ success: true, message: 'Arquivo não é um documento de texto, aprendizado não aplicável.' });
        }
        
        const cleanedText = text.replace(/\s+/g, ' ').trim();
        const textChunks = chunkText(cleanedText);

        // 4. Gerar o "índice inteligente" (embedding) para cada pedaço
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
        
        // 5. Salvar os pedaços e seus índices na tabela do "cérebro" da Stella
        if (recordsToInsert.length > 0) {
            await supabase.from('empreendimento_documento_embeddings').insert(recordsToInsert);
        }

        return NextResponse.json({ success: true, message: 'Documento estudado e memorizado pela IA.' });

    } catch (error) {
        console.error("[process-anexo] Erro:", error);
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}