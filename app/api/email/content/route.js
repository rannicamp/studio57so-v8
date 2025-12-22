import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser'; // Vamos usar se disponível, ou fallback manual

export async function GET(request) {
    // 1. OBRIGATÓRIO NO NEXT 15: await no cliente
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const folderName = searchParams.get('folder');
    const accountId = searchParams.get('accountId');

    if (!uid || !folderName) {
        return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    let connection = null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 2. BUSCAR A CONTA CERTA
        let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        
        // Se veio o ID da conta, usa ele para garantir que abrimos o e-mail certo
        if (accountId && accountId !== 'undefined') {
            query = query.eq('id', accountId);
        }
        
        const { data: configs } = await query;
        const config = configs?.[0];

        if (!config) return NextResponse.json({ error: 'Conta de e-mail não encontrada' }, { status: 404 });

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

        connection = await imapSimple.connect(imapConfig);
        
        // Abre a caixa (modo somente leitura para não marcar lido sem querer)
        await connection.openBox(folderName, { readOnly: false }); // False para permitir flag \Seen se necessário depois

        const searchCriteria = [['UID', uid]];
        const fetchOptions = {
            bodies: [''], // Pega o corpo inteiro (RAW)
            markSeen: false // Controlamos isso via frontend
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length === 0) {
            return NextResponse.json({ error: 'E-mail não encontrado' }, { status: 404 });
        }

        const message = messages[0];
        // Pega o corpo bruto (source) do e-mail
        const allParts = message.parts.find(part => part.which === '');
        const source = allParts?.body;

        // 3. PARSEAR O E-MAIL (Transformar código em Texto/HTML)
        // Usamos simpleParser para lidar com anexos e HTML complexo
        const parsed = await simpleParser(source);

        const emailData = {
            id: uid,
            subject: parsed.subject,
            from: parsed.from?.text,
            to: parsed.to?.text,
            cc: parsed.cc?.text,
            date: parsed.date,
            html: parsed.html || false,
            text: parsed.textAsHtml || parsed.text, // Fallback para texto
            attachments: parsed.attachments.map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                content: att.content // Envia o buffer (cuidado com tamanho, ideal seria rota separada para anexos grandes)
            }))
        };

        return NextResponse.json(emailData);

    } catch (error) {
        console.error('Erro ao baixar conteúdo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try { connection.end(); } catch(e) {}
        }
    }
}