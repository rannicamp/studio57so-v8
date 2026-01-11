import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET(request) {
    // 1. OBRIGATÓRIO NO NEXT 15: await no cliente
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const folderName = searchParams.get('folder');
    const accountId = searchParams.get('accountId'); // ID da configuração no banco

    if (!uid || !folderName) {
        return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // --- ESTRATÉGIA DE CACHE (Carregamento Mágico) 🎩 ---
        
        // 1. Tenta buscar no banco primeiro (Super Rápido ⚡)
        let queryCache = supabase
            .from('email_messages_cache')
            .select('conteudo_cache')
            .eq('uid', uid)
            .eq('folder_path', folderName);

        // Se veio o accountId, usa para garantir que é a conta certa
        if (accountId && accountId !== 'undefined') {
            queryCache = queryCache.eq('account_id', accountId);
        }

        const { data: cacheData, error: cacheError } = await queryCache.single();

        // SE ACHOU NO CACHE, RETORNA IMEDIATAMENTE!
        if (!cacheError && cacheData?.conteudo_cache) {
            console.log(`🚀 E-mail ${uid} carregado do Cache DB!`);
            return NextResponse.json(cacheData.conteudo_cache);
        }

        // --- SE NÃO ACHOU, VAI NO IMAP (Busca Lenta 🐢) ---
        console.log(`🐢 E-mail ${uid} não está no cache. Buscando no IMAP...`);

        // 2. Busca as credenciais
        let queryConfig = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        
        if (accountId && accountId !== 'undefined') {
            queryConfig = queryConfig.eq('id', accountId);
        }
        
        const { data: configs } = await queryConfig;
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

        const connection = await imapSimple.connect(imapConfig);
        
        // Abre a caixa
        await connection.openBox(folderName, { readOnly: false }); 

        const searchCriteria = [['UID', uid]];
        const fetchOptions = {
            bodies: [''], // Pega o corpo inteiro (RAW)
            markSeen: true // Já marca como lido no servidor se abriu o conteúdo
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length === 0) {
            connection.end();
            return NextResponse.json({ error: 'E-mail não encontrado no servidor' }, { status: 404 });
        }

        const message = messages[0];
        const allParts = message.parts.find(part => part.which === '');
        const source = allParts?.body;

        // 3. Processa o e-mail
        const parsed = await simpleParser(source);

        const emailData = {
            id: uid,
            subject: parsed.subject,
            from: parsed.from?.text,
            to: parsed.to?.text,
            cc: parsed.cc?.text,
            date: parsed.date,
            html: parsed.html || false, // O HTML completo
            text: parsed.textAsHtml || parsed.text, 
            attachments: parsed.attachments.map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                // Nota: O conteúdo do anexo vai como buffer base64 para o front renderizar
                content: att.content 
            }))
        };

        connection.end();

        // --- SALVA NO CACHE PARA A PRÓXIMA VEZ ---
        // Atualiza a linha existente ou cria uma nova
        const { error: updateError } = await supabase
            .from('email_messages_cache')
            .upsert({
                account_id: config.id,
                uid: uid,
                folder_path: folderName,
                // Garante dados básicos caso não existam (ex: se o sync não rodou ainda)
                subject: parsed.subject || '(Sem Assunto)',
                from_text: parsed.from?.text || '',
                date: parsed.date || new Date(),
                is_read: true, 
                conteudo_cache: emailData, // <--- AQUI VAI O OURO
                updated_at: new Date().toISOString()
            }, { onConflict: 'account_id, folder_path, uid' });

        if (updateError) {
            console.error('Erro ao salvar cache:', updateError);
        } else {
            console.log(`💾 E-mail ${uid} salvo no cache com sucesso!`);
        }

        return NextResponse.json(emailData);

    } catch (error) {
        console.error('Erro ao baixar conteúdo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}