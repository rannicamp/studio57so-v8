import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// ROTA TEMPORÁRIA DE DIAGNÓSTICO - REMOVER APÓS USO
export async function GET(request) {
    const supabase = await createClient();
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        if (accountId) query = query.eq('id', accountId);
        
        const { data: configs, error: dbError } = await query;
        
        if (dbError) return NextResponse.json({ error: 'Erro no banco: ' + dbError.message });
        if (!configs || configs.length === 0) return NextResponse.json({ error: 'Nenhuma configuração encontrada' });

        const results = [];
        
        for (const config of configs) {
            const senhaLen = config.senha_app ? config.senha_app.length : 0;
            const senhaPreview = config.senha_app 
                ? config.senha_app.substring(0, 4) + '****' + config.senha_app.substring(senhaLen - 2)
                : 'NULA/VAZIA';
            
            const info = {
                id: config.id,
                email: config.email,
                imap_user: config.imap_user || '(não definido - usa email)',
                imap_user_efetivo: config.imap_user || config.email,
                imap_host: config.imap_host,
                imap_port: config.imap_port || 993,
                senha_length: senhaLen,
                senha_preview: senhaPreview,
                senha_tem_espacos: config.senha_app ? config.senha_app.includes(' ') : false,
                senha_tem_newline: config.senha_app ? (config.senha_app.includes('\n') || config.senha_app.includes('\r')) : false,
                connectionTest: null,
                connectionError: null,
                connectionErrorCode: null,
            };

            // Testa a conexão IMAP
            let connection = null;
            try {
                const imapConfig = {
                    imap: {
                        user: config.imap_user || config.email,
                        password: config.senha_app,
                        host: config.imap_host,
                        port: config.imap_port || 993,
                        tls: true,
                        authTimeout: 15000,
                        connTimeout: 15000,
                        tlsOptions: { rejectUnauthorized: false }
                    },
                };
                connection = await imapSimple.connect(imapConfig);
                info.connectionTest = '✅ SUCESSO! Conexão estabelecida!';
                connection.end();
            } catch (connError) {
                info.connectionTest = '❌ FALHOU';
                info.connectionError = connError.message;
                info.connectionErrorCode = connError.textCode || connError.code || 'SEM_CODIGO';
                info.connectionSource = connError.source || 'desconhecido';
            }

            results.push(info);
        }

        return NextResponse.json({ 
            timestamp: new Date().toISOString(),
            user_id: user.id,
            accounts: results 
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
