import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função GET original para verificar as variáveis de ambiente
export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  const debugInfo = {
    supabaseUrl: supabaseUrl || "NÃO ENCONTRADA",
    serviceRoleKey_Present: !!serviceRoleKey,
    serviceRoleKey_Length: serviceRoleKey ? serviceRoleKey.length : 0,
    whatsappVerifyToken: whatsappVerifyToken || "NÃO ENCONTRADA",
  };

  console.log("DEBUG ENV (GET):", debugInfo);
  return NextResponse.json(debugInfo);
}


// Nova função POST para testar o upload e a inserção no banco
export async function POST(request) {
    console.log("-----------------------------------------");
    console.log("--- INÍCIO DO TESTE DE UPLOAD E SALVAMENTO ---");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Verificação das Chaves
    console.log(`URL do Supabase encontrada: ${!!supabaseUrl}`);
    console.log(`Chave de Serviço (Service Role) encontrada: ${!!supabaseServiceKey}`);
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("ERRO CRÍTICO: Variáveis de ambiente não encontradas.");
        return NextResponse.json({
            sucesso: false,
            passo: "Verificação de Chaves",
            mensagem: "As variáveis de ambiente do Supabase (URL ou Service Role Key) não foram encontradas no servidor.",
        }, { status: 500 });
    }
    console.log("PASSO 1: Verificação de chaves concluída.");

    // 2. Inicialização do Cliente Admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log("PASSO 2: Cliente Supabase Admin inicializado.");

    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse.json({ sucesso: false, passo: "Recebimento do Arquivo", mensagem: "Nenhum arquivo foi recebido pela API." }, { status: 400 });
        }
        console.log(`PASSO 3: Arquivo "${file.name}" recebido.`);

        // 4. Upload para o Storage
        const filePath = `debug-uploads/${Date.now()}_${file.name}`;
        console.log(`PASSO 4: Tentando fazer upload para o Storage em: ${filePath}`);
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('whatsapp-media')
            .upload(filePath, file);

        if (uploadError) {
            console.error("ERRO NO UPLOAD PARA O STORAGE:", uploadError);
            return NextResponse.json({ sucesso: false, passo: "Upload para o Storage", mensagem: uploadError.message, detalhes: uploadError }, { status: 500 });
        }
        console.log("PASSO 4.1: Upload para o Storage bem-sucedido.", uploadData);

        // 5. Tentativa de Inserção no Banco de Dados
        const testData = {
            contato_id: 661,
            storage_path: filePath,
            public_url: 'teste',
            file_name: file.name,
            file_type: file.type,
            file_size: file.size
        };
        
        console.log("PASSO 5: Tentando inserir os seguintes dados na tabela 'whatsapp_attachments':", testData);

        const { data, error: dbError } = await supabaseAdmin
            .from('whatsapp_attachments')
            .insert(testData)
            .select()
            .single();

        if (dbError) {
            console.error("ERRO DE INSERÇÃO NO BANCO DE DADOS:", dbError);
             return NextResponse.json({
                sucesso: false,
                passo: "Inserção no Banco de Dados",
                mensagem: dbError.message,
                detalhes: {
                    codigo: dbError.code,
                    hint: dbError.hint,
                    detalhe_completo: dbError.details,
                }
            }, { status: 500 });
        }

        console.log("--- TESTE CONCLUÍDO COM SUCESSO ---");
        return NextResponse.json({
            sucesso: true,
            passo: "Finalizado",
            mensagem: "Arquivo enviado e registro salvo com sucesso!",
            dados_salvos: data
        });

    } catch (error) {
        console.error("ERRO INESPERADO NA API DE DEBUG:", error);
        return NextResponse.json({ sucesso: false, passo: "Erro Geral", mensagem: error.message }, { status: 500 });
    }
}