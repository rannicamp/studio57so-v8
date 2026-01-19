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

        // 1. TENTA CACHE DO BANCO (Se já clicou antes, carrega rápido)
        let queryCache = supabase
            .from('email_messages_cache')
            .select('conteudo_cache')
            .eq('uid', uid)
            .eq('folder_path', folderName);
            
        if (accountId) queryCache = queryCache.eq('account_id', accountId);

        const { data: cacheData } = await queryCache.single();

        // Se já temos o conteúdo completo cacheado, retorna ele
        if (cacheData?.conteudo_cache && cacheData.conteudo_cache.html) {
            return NextResponse.json(cacheData.conteudo_cache);
        }

        // 2. SE NÃO TEM (Primeiro clique), VAI NO IMAP
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
        await connection.openBox(folderName, { readOnly: true }); // ReadOnly para não marcar lido sem querer

        const searchCriteria = [['UID', uid]];
        const fetchOptions = { bodies: [''], markSeen: false }; // Pega corpo completo

        const messages = await connection.search(searchCriteria, fetchOptions);
        if (messages.length === 0) {
            connection.end();
            return NextResponse.json({ error: 'E-mail não encontrado no servidor' }, { status: 404 });
        }

        const source = messages[0].parts.find(part => part.which === '')?.body;
        
        // Parseia o e-mail bruto
        const parsed = await simpleParser(source);

        // 3. SANITIZAÇÃO DE DADOS (CRÍTICO PARA PERFORMANCE)
        // Prepara os dados para salvar no banco SEM O CONTEÚDO DOS ANEXOS
        const attachmentsMeta = parsed.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            // NÃO SALVAMOS O BUFFER NO BANCO (Isso matava seu Supabase)
            content: null 
        }));

        const emailDataForDb = {
            id: uid,
            subject: parsed.subject,
            from: parsed.from?.text,
            to: parsed.to?.text,
            cc: parsed.cc?.text,
            date: parsed.date,
            html: parsed.html || parsed.textAsHtml || '', // Garante HTML
            text: parsed.text || '',
            attachments: attachmentsMeta // Metadados leves
        };

        // 4. ATUALIZA O CACHE NO BANCO
        // Agora salvamos o corpo para a próxima vez ser rápida, mas sem o peso dos arquivos
        await supabase
            .from('email_messages_cache')
            .update({
                conteudo_cache: emailDataForDb, // Salva JSON leve
                html_body: emailDataForDb.html ? emailDataForDb.html.substring(0, 100000) : null, // Opcional: limita tamanho
                has_attachments: parsed.attachments.length > 0,
                updated_at: new Date().toISOString()
            })
            .eq('uid', uid)
            .eq('folder_path', folderName)
            .eq('account_id', config.id);

        connection.end();

        // 5. RESPOSTA PARA O FRONTEND (COM ANEXOS)
        // Para o usuário ver AGORA, mandamos os anexos em memória (sem salvar no banco)
        const responseData = {
            ...emailDataForDb,
            attachments: parsed.attachments.map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                // Aqui mandamos o conteúdo para o navegador baixar se quiser
                content: att.content 
            }))
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Erro ao baixar conteúdo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}