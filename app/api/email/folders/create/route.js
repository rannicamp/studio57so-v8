import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function POST(request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { folderName, parentPath } = body;

        if (!folderName) {
            return NextResponse.json({ error: 'Nome da pasta é obrigatório' }, { status: 400 });
        }

        // 1. Autenticação
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 2. Configurações
        const { data: config } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).single();
        if (!config) return NextResponse.json({ error: 'Configure seu e-mail.' }, { status: 404 });

        // 3. Conexão IMAP
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

        const connection = await imapSimple.connect(imapConfig);

        // 4. Montar o caminho (Path)
        // Se tiver pai, é "Pai/Filho". Se não, é só "Filho".
        // O delimitador padrão geralmente é '/', mas o IMAP resolve internamente na maioria dos casos modernos.
        let fullPath = folderName;
        if (parentPath) {
            // Tenta descobrir o delimitador da pasta pai (buscando na lista seria o ideal, mas vamos usar / como padrão seguro)
            const delimiter = '/'; 
            fullPath = `${parentPath}${delimiter}${folderName}`;
        }

        // 5. Criar a Pasta
        try {
            await connection.addBox(fullPath);
        } catch (imapError) {
            // Tenta com delimitador diferente se falhar (ex: ponto)
            if (parentPath) {
                 fullPath = `${parentPath}.${folderName}`;
                 await connection.addBox(fullPath);
            } else {
                throw imapError;
            }
        }

        connection.end();

        return NextResponse.json({ success: true, path: fullPath });

    } catch (error) {
        console.error('Erro ao criar pasta:', error);
        return NextResponse.json({ error: error.message || 'Falha ao criar pasta' }, { status: 500 });
    }
}