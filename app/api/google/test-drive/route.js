import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { getDriveService, getOrCreateFolder, uploadFileToDrive } from '@/lib/googleDrive';
import { Readable } from 'stream';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Pega a integração de drive
    const { data: integracoes } = await supabase.from('integracoes_google')
        .select('*')
        .eq('tipo_conexao', 'drive')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (!integracoes || integracoes.length === 0) {
        return NextResponse.json({ error: 'Nenhuma integração Organizacional conectada. Conecte nas configurações primeiro.' });
    }
    const integracao = integracoes[0];

    // 2. Tenta inicializar o Drive
    const drive = getDriveService(integracao.access_token, integracao.refresh_token);

    // 3. Cria a pasta mestre
    const rootFolderId = await getOrCreateFolder(drive, 'Elo 57 - Backups');
    
    // 4. Prepara um arquivo CSV falso para teste
    const csvContent = "id,nome,status\n1,Teste Drive,Sucesso\n2,Outro Teste,Pendente";
    const bufferStream = new Readable();
    bufferStream.push(csvContent);
    bufferStream.push(null); // End of stream

    // 5. Faz o Upload
    const file = await uploadFileToDrive({
      accessToken: integracao.access_token,
      refreshToken: integracao.refresh_token,
      fileName: `backup_teste_${new Date().getTime()}.csv`,
      mimeType: 'text/csv',
      fileStreamOrBuffer: bufferStream,
      folderId: rootFolderId
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Arquivo criado com sucesso no Google Drive!',
      folderId: rootFolderId,
      fileId: file.id,
      link: file.webViewLink
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Erro na API do Google Drive', 
      message: error.message, 
      code: error.code,
      status: error.status
    });
  }
}
