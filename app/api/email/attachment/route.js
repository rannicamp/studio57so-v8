import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

export const dynamic = 'force-dynamic';

export async function GET(request) {
 const supabase = await createClient();
 const { searchParams } = new URL(request.url);

 const uid = searchParams.get('uid');
 const folderName = searchParams.get('folder');
 const accountId = searchParams.get('accountId');
 const filename = searchParams.get('filename');

 if (!uid || !folderName || !filename) {
 return new NextResponse('Dados inválidos ou faltando filename', { status: 400 });
 }

 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return new NextResponse('Não autorizado', { status: 401 });

 // 1. Busca configurações da conta
 let queryConfig = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
 if (accountId) queryConfig = queryConfig.eq('id', accountId);

 const { data: configs } = await queryConfig;
 const config = configs?.[0];

 if (!config) return new NextResponse('Configuração não encontrada', { status: 404 });

 const imapConfig = {
 imap: {
 user: config.imap_user || config.email,
 password: config.senha_app,
 host: config.imap_host,
 port: config.imap_port || 993,
 tls: true,
 authTimeout: 20000,
 tlsOptions: { rejectUnauthorized: false }
 },
 };

 const connection = await imapSimple.connect(imapConfig);
 await connection.openBox(folderName, { readOnly: true });

 const searchCriteria = [['UID', uid]];

 // Baixa o e-mail completo para garantir que extraímos o anexo binário
 const fetchOptions = { bodies: [''] };

 const messages = await connection.search(searchCriteria, fetchOptions);

 if (messages.length === 0) {
 connection.end();
 return new NextResponse('E-mail não encontrado', { status: 404 });
 }

 const source = messages[0].parts.find(part => part.which === '')?.body;
 const parsed = await simpleParser(source);

 // Encontra o anexo específico solicitado pelo nome do arquivo
 const attachment = parsed.attachments.find(att => att.filename === filename);

 if (!attachment) {
 connection.end();
 return new NextResponse('Anexo não encontrado na mensagem', { status: 404 });
 }

 connection.end();

 // 3. RETORNA O BUFFER DIRETAMENTE COMO STREAM/DOWNLOAD NO FRONT
 return new NextResponse(attachment.content, {
 status: 200,
 headers: {
 'Content-Type': attachment.contentType || 'application/octet-stream',
 'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
 'Content-Length': attachment.size.toString()
 }
 });

 } catch (error) {
 console.error('Erro ao baixar anexo especifico:', error);
 return new NextResponse('Erro interno ao processar o arquivo', { status: 500 });
 }
}
