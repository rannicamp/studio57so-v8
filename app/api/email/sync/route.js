import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// Configuração Next.js
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Permite rodar por até 60s

export async function POST(request) {
    const supabase = await createClient();
    let connection = null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. Busca contas configuradas
        const { data: accounts } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id);

        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ message: 'Nenhuma conta configurada.', totalNew: 0 });
        }

        let totalNewEmails = 0;

        // 2. Itera sobre as contas
        for (const config of accounts) {
            try {
                const imapConfig = {
                    imap: {
                        user: config.imap_user || config.email,
                        password: config.senha_app,
                        host: config.imap_host,
                        port: config.imap_port || 993,
                        tls: true,
                        authTimeout: 15000,
                        tlsOptions: { rejectUnauthorized: false }
                    },
                };

                connection = await imapSimple.connect(imapConfig);
                await connection.openBox('INBOX', { readOnly: true }); // Apenas leitura para sync

                // --- ESTRATÉGIA HÍBRIDA ---
                // Buscamos e-mails que NÃO temos no banco ou os mais recentes.
                // Para garantir que a lista antiga apareça, vamos pegar uma janela maior,
                // mas pedindo APENAS CABEÇALHOS (Super Leve).
                
                // Pega o maior UID que já temos para saber onde paramos
                const lastUid = Number(config.last_sync_uid) || 1;
                
                // Busca UIDs maiores que o último syncado (Novos)
                const searchCriteria = [['UID', `${lastUid}:*`]];
                
                const fetchOptions = {
                    // O SEGREDO ESTÁ AQUI: NÃO PEDIMOS 'BODY' NEM 'TEXT'
                    bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)'],
                    struct: true,
                    markSeen: false 
                };

                const messages = await connection.search(searchCriteria, fetchOptions);
                
                if (messages.length === 0) {
                    connection.end();
                    continue;
                }

                let maxUid = lastUid;
                const batchSize = 50; // Processa em lotes para não estourar memória
                
                for (let i = 0; i < messages.length; i += batchSize) {
                    const batch = messages.slice(i, i + batchSize);
                    const upsertData = [];

                    for (const message of batch) {
                        const uid = message.attributes.uid;
                        if (uid > maxUid) maxUid = uid;

                        // Pega o cabeçalho
                        const part = message.parts.find(p => p.which && p.which.includes('HEADER'));
                        const headers = part?.body || {};

                        // Tratamento de dados básico
                        const subject = headers.subject ? headers.subject[0] : '(Sem Assunto)';
                        const from = headers.from ? headers.from[0] : '';
                        const date = headers.date ? new Date(headers.date[0]) : new Date();

                        // Prepara objeto LEVE para o banco
                        upsertData.push({
                            account_id: config.id,
                            uid: uid,
                            folder_path: 'INBOX',
                            subject: decodeHeader(subject).substring(0, 200), // Limita tamanho
                            from_text: decodeHeader(from).substring(0, 100),
                            date: date,
                            is_read: false, // Assume não lido inicialmente ou atualiza depois
                            // CAMPOS PESADOS COMO NULL (SISTEMA HÍBRIDO)
                            conteudo_cache: null, 
                            html_body: null,
                            text_body: null,
                            has_attachments: false, // Será verificado ao abrir
                            updated_at: new Date().toISOString()
                        });
                    }

                    // Salva no banco (Upsert para não duplicar)
                    if (upsertData.length > 0) {
                        const { error } = await supabase
                            .from('email_messages_cache')
                            .upsert(upsertData, { 
                                onConflict: 'account_id, folder_path, uid',
                                ignoreDuplicates: true // Se já existe, não mexe (preserva se já tiver corpo baixado)
                            });
                        
                        if (error) console.error('Erro sync batch:', error);
                        else totalNewEmails += upsertData.length;
                    }
                }

                // Atualiza o ponteiro do último sync na configuração
                if (maxUid > lastUid) {
                    await supabase.from('email_configuracoes')
                        .update({ last_sync_uid: maxUid })
                        .eq('id', config.id);
                }

                connection.end();

            } catch (err) {
                console.error(`Erro sync conta ${config.email}:`, err);
                if (connection) try { connection.end(); } catch {}
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Sync Híbrido concluído', 
            totalNew: totalNewEmails 
        });

    } catch (error) {
        console.error('Erro geral sync:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Função auxiliar para decodificar caracteres especiais de e-mail (UTF-8, etc)
function decodeHeader(str) {
    if (!str) return '';
    return str.replace(/=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g, (match, charset, encoding, content) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                return Buffer.from(content, 'base64').toString('utf8');
            } else if (encoding.toUpperCase() === 'Q') {
                return decodeURIComponent(content.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1'));
            }
        } catch (e) { return match; }
        return match;
    });
}