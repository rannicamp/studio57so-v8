// app/api/test-insert/route.js

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // A requisição agora pode ter 'to' (número), 'text' (conteúdo da mensagem/legenda)
    // e 'attachment' (objeto com metadados do anexo, se houver)
    const { to, text, attachment } = await request.json();

    if (!to) {
      return NextResponse.json({
        success: false,
        error: "O número de telefone 'to' é obrigatório para enviar a mensagem."
      }, {
        status: 400
      });
    }

    let saveAttachmentResult = null; // Para armazenar o resultado do salvamento do anexo no DB
    
    let attachmentTypeForWhatsApp = null;
    let attachmentLinkForWhatsApp = null;
    let attachmentFilenameForWhatsApp = null;

    // PASSO 1: Se um anexo for fornecido, primeiro salvamos seus metadados no nosso banco de dados
    if (attachment) {
      // Validação dos campos do anexo
      if (!attachment.contato_id || !attachment.storage_path || !attachment.public_url || !attachment.file_name || !attachment.file_type || !attachment.file_size) {
        return NextResponse.json({
          success: false,
          error: "Dados do anexo incompletos. Certifique-se de que o objeto 'attachment' contenha: contato_id, storage_path, public_url, file_name, file_type, file_size."
        }, {
          status: 400
        });
      }

      // Chama a sua API /api/whatsapp/save-attachment para salvar os metadados no DB
      const saveAttachmentResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/save-attachment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_contato_id: attachment.contato_id,
          p_storage_path: attachment.storage_path,
          p_public_url: attachment.public_url,
          p_file_name: attachment.file_name,
          p_file_type: attachment.file_type,
          p_file_size: attachment.file_size,
        }),
      });

      saveAttachmentResult = await saveAttachmentResponse.json();

      if (!saveAttachmentResponse.ok) {
        console.error('Erro na simulação do save-attachment:', saveAttachmentResult.error);
        return NextResponse.json({
          success: false,
          message: 'Falha ao salvar metadados do anexo no banco de dados. Verifique os detalhes do erro retornado por /api/whatsapp/save-attachment.',
          details: saveAttachmentResult.error || 'Erro desconhecido',
          httpStatus: saveAttachmentResponse.status
        }, {
          status: saveAttachmentResponse.status
        });
      }

      // Prepara os detalhes do anexo para o payload da API do WhatsApp (rota /api/whatsapp/send)
      const mediaTypeRaw = attachment.file_type.split('/')[0]; // Ex: 'image', 'application'
      if (mediaTypeRaw === 'application' && attachment.file_type.includes('pdf')) {
          attachmentTypeForWhatsApp = 'document';
      } else if (mediaTypeRaw === 'image' || mediaTypeRaw === 'video' || mediaTypeRaw === 'audio') {
          attachmentTypeForWhatsApp = mediaTypeRaw;
      } else {
          // Se não for um tipo de mídia específico (imagem, vídeo, áudio), trata como documento
          attachmentTypeForWhatsApp = 'document';
      }
      attachmentLinkForWhatsApp = attachment.public_url;
      attachmentFilenameForWhatsApp = attachment.file_name;

    }

    // PASSO 2: Enviar a mensagem (com ou sem anexo) via API do WhatsApp
    const sendPayload = {
      to: to,
      // O 'type' e o conteúdo dependem se há um anexo
      type: attachmentTypeForWhatsApp || 'text', // Usa o tipo do anexo se presente, senão 'text'
      text: attachmentTypeForWhatsApp ? undefined : text, // 'text' só é enviado se NÃO houver anexo
      link: attachmentLinkForWhatsApp,
      filename: attachmentFilenameForWhatsApp,
      caption: attachmentTypeForWhatsApp ? text : undefined, // 'text' vira 'caption' se houver anexo
    };

    // Remove valores 'undefined' do payload para evitar problemas na API do WhatsApp
    for (const key in sendPayload) {
      if (sendPayload[key] === undefined) {
        delete sendPayload[key];
      }
    }

    // Chama a sua API /api/whatsapp/send para realmente enviar a mensagem
    const sendMessageResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendPayload),
    });

    const sendMessageResult = await sendMessageResponse.json();

    if (!sendMessageResponse.ok) {
      console.error('Erro ao simular envio de mensagem WhatsApp:', sendMessageResult.error);
      return NextResponse.json({
        success: false,
        message: 'Falha ao enviar a mensagem pelo WhatsApp. Verifique os detalhes do erro retornado por /api/whatsapp/send.',
        details: sendMessageResult.error || 'Erro desconhecido',
        httpStatus: sendMessageResponse.status,
        saveAttachmentResult: saveAttachmentResult // Inclui o resultado do passo anterior para depuração completa
      }, {
        status: sendMessageResponse.status
      });
    }

    // Se tudo deu certo, retorna sucesso com os resultados de ambos os passos
    return NextResponse.json({
      success: true,
      message: 'Teste de envio de mensagem (com/sem anexo) concluído com sucesso!',
      saveAttachmentResult: saveAttachmentResult, // Resultado do salvamento de metadados no DB
      sendMessageResult: sendMessageResult,     // Resultado do envio da mensagem via WhatsApp
    });

  } catch (e) {
    console.error('Erro inesperado na API de teste (catch principal):', e);
    return NextResponse.json({
      success: false,
      error: `Erro inesperado durante o teste: ${e.message}. Verifique os logs do servidor para mais detalhes.`
    }, {
      status: 500
    });
  }
}