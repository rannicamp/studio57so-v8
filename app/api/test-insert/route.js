// app/api/test-insert/route.js

import { NextResponse } from 'next/server';
// CORREÇÃO: O caminho foi ajustado de 4 para 3 níveis de diretório.
// import { createClient } from '../../../utils/supabase/server'; // Não é necessário para este teste de proxy

export async function POST(request) {
  // O cliente Supabase criado aqui não é usado diretamente para o teste do anexo,
  // mas foi mantido caso haja outra funcionalidade que o utilize ou para expansão futura.
  // const supabase = createClient();

  try {
    // Esperamos um JSON no corpo da requisição com os dados do anexo a serem testados
    const {
      contato_id,
      storage_path,
      public_url,
      file_name,
      file_type,
      file_size
    } = await request.json();

    // Validação básica dos dados de teste
    if (!contato_id || !storage_path || !public_url || !file_name || !file_type || !file_size) {
      return NextResponse.json({
        success: false,
        error: "Dados de teste insuficientes para simular o anexo. Certifique-se de incluir todos os campos necessários (contato_id, storage_path, public_url, file_name, file_type, file_size)."
      }, {
        status: 400
      });
    }

    // Simula a chamada que o componente WhatsAppChatManager faz para /api/whatsapp/save-attachment
    // Usamos `request.nextUrl.origin` para garantir que a URL seja correta no ambiente de deploy
    const saveAttachmentResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/save-attachment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Passamos os dados de teste para a API de salvamento de anexo
        p_contato_id: contato_id,
        p_storage_path: storage_path,
        p_public_url: public_url,
        p_file_name: file_name,
        p_file_type: file_type,
        p_file_size: file_size,
      }),
    });

    const result = await saveAttachmentResponse.json();

    if (!saveAttachmentResponse.ok) {
      console.error('Erro na simulação do save-attachment:', result.error);
      return NextResponse.json({
        success: false,
        message: 'Falha na simulação do save-attachment. Verifique os detalhes do erro.',
        details: result.error || 'Erro desconhecido ao chamar a API save-attachment',
        httpStatus: saveAttachmentResponse.status
      }, {
        status: saveAttachmentResponse.status
      });
    }

    // Retorna a resposta completa da API save-attachment para depuração
    return NextResponse.json({
      success: true,
      message: 'Simulação de anexo enviada para save-attachment com sucesso!',
      saveAttachmentResult: result, // Inclui a resposta da API save-attachment
    });

  } catch (e) {
    console.error('Erro inesperado na API de teste para anexo:', e);
    return NextResponse.json({
      success: false,
      error: `Erro inesperado: ${e.message}. Verifique os logs do servidor.`
    }, {
      status: 500
    });
  }
}