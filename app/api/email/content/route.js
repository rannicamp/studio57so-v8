import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET(request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const folderName = searchParams.get('folder');
    const accountId = searchParams.get('accountId');

    if (!uid || !folderName) {
        return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. TENTA CACHE DO BANCO
        let queryCache = supabase
            .from('email_messages_cache')
            .select('conteudo_cache, is_read') // Adicionei is_read para verificar
            .eq('uid', uid)
            .eq('folder_path', folderName);
            
        if (accountId) queryCache = queryCache.eq('account_id', accountId);

        const { data: cacheData } = await queryCache.single();

        // Se já tem conteúdo E já está marcado como lido, retorna rápido
        if (cacheData?.conteudo_cache && cacheData.conteudo_cache.html) {
             // Pequena segurança: Se no banco diz que não leu, mas o usuário abriu agora, atualizamos o status de leitura
             if (cacheData.is_read === false) {
                 await supabase.from('email_messages_cache')
                    .update({ is_read: true })
                    .eq('uid', uid)
                    .eq('folder_path', folderName)
                    .eq('account_id', accountId);
             }
            return NextResponse.json(cacheData.conteudo_cache);
        }

        // 2. BUSCA NO IMAP (Se não tem cache ou é a primeira leitura)
        let queryConfig = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        if (accountId) queryConfig = queryConfig.eq('id', accountId);
        
        const { data: configs } = await queryConfig;
        const config = configs?.[0];

        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

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
        await connection.openBox(folderName, { readOnly: false }); // MUDANÇA: readOnly false para permitir marcar como lido

        const searchCriteria = [['UID', uid]];
        
        // --- MUDANÇA CRUCIAL AQUI ---
        // Ao baixar o conteúdo, marcamos como VISTO (Seen/Lido) no servidor de e-mail
        const fetchOptions = { 
            bodies: [''], 
            markSeen: true 
        }; 

        const messages = await connection.search(searchCriteria, fetchOptions);
        
        if (messages.length === 0) {
            connection.end();
            return NextResponse.json({ error: 'E-mail não encontrado' }, { status: 404 });
        }

        const source = messages[0].parts.find(part => part.which === '')?.body;
        const parsed = await simpleParser(source);

        // Sanitização de anexos (Mantendo a lógica leve do plano anterior)
        const attachmentsMeta = parsed.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            content: null 
        }));

        const emailDataForDb = {
            id: uid,
            subject: parsed.subject,
            from: parsed.from?.text,
            to: parsed.to?.text,
            cc: parsed.cc?.text,
            date: parsed.date,
            html: parsed.html || parsed.textAsHtml || '', 
            text: parsed.text || '',
            attachments: attachmentsMeta
        };

        // 3. ATUALIZA O CACHE E O STATUS DE LEITURA
        await supabase
            .from('email_messages_cache')
            .update({
                conteudo_cache: emailDataForDb,
                html_body: emailDataForDb.html ? emailDataForDb.html.substring(0, 100000) : null,
                has_attachments: parsed.attachments.length > 0,
                is_read: true, // <--- MUDANÇA: Força o status LIDO no banco
                updated_at: new Date().toISOString()
            })
            .eq('uid', uid)
            .eq('folder_path', folderName)
            .eq('account_id', config.id);

        connection.end();

        const responseData = {
            ...emailDataForDb,
            attachments: parsed.attachments.map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                content: att.content 
            }))
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Erro ao baixar conteúdo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}