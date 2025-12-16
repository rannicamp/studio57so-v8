import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function GET() {
  const supabase = createClient();
  let connection = null;

  try {
    // 1. Verificar Autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 2. Buscar Configurações
    const { data: config, error } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: 'E-mail não configurado' }, { status: 404 });
    }

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

    connection = await imapSimple.connect(imapConfig);
    const boxes = await connection.getBoxes();
    // NÃO FECHA A CONEXÃO AQUI! PRECISAREMOS DELA PARA O STATUS UNSEEN.

    // 4. Mapeamento de Nomes (Tradução e ícones)
    const folderTranslations = {
      'INBOX': 'Caixa de Entrada',
      'SENT': 'Enviados',
      'DRAFTS': 'Rascunhos',
      'TRASH': 'Lixeira',
      'JUNK': 'Spam',
      'SPAM': 'Spam',
      'ARCHIVE': 'Arquivados'
    };

    const folderList = [];

    // 5. Função Recursiva (Processa a lista primeiro)
    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            const delimiter = value.delimiter || '/';
            // Constrói o caminho completo
            const fullPath = parentPath ? `${parentPath}${delimiter}${key}` : key;

            let displayName = key;
            const upperKey = key.toUpperCase();
            
            if (folderTranslations[upperKey]) {
                displayName = folderTranslations[upperKey];
            } else if (key.toUpperCase().includes('SEND') || key.toUpperCase().includes('SENT')) {
                 displayName = 'Enviados';
            }

            // Ignora container do Gmail [Gmail]
            if (key.startsWith('[Gmail]')) {
                if (value.children) processBoxes(value.children, fullPath, level);
                continue; 
            }

            folderList.push({
                name: key,
                displayName: displayName,
                path: fullPath,
                delimiter: delimiter,
                attribs: value.attribs,
                level: level,
                special: !!folderTranslations[upperKey],
                unseen: 0 // Valor padrão
            });
            
            if (value.children) {
                processBoxes(value.children, fullPath, level + 1);
            }
        }
    };

    processBoxes(boxes);

    // 6. BUSCA CONTADORES (Agora com a conexão ABERTA)
    // Limitamos a execução para não estourar o tempo se houver muitas pastas
    try {
        await Promise.all(folderList.map(async (folder) => {
            try {
                // Pega o status apenas de UNSEEN
                const status = await connection.status(folder.path, { unseen: true });
                folder.unseen = status.unseen || 0;
            } catch (err) {
                // Se falhar em uma pasta (ex: permissão), define como 0 e segue a vida
                folder.unseen = 0;
            }
        }));
    } catch (statusError) {
        console.error("Erro ao buscar contadores:", statusError);
        // Não quebra a rota, apenas devolve sem contadores
    }

    // 7. Ordenação Inteligente
    const specialOrder = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Spam', 'Lixeira', 'Arquivados'];

    folderList.sort((a, b) => {
        const indexA = specialOrder.indexOf(a.displayName);
        const indexB = specialOrder.indexOf(b.displayName);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        return a.path.localeCompare(b.path);
    });

    // 8. AGORA SIM, FECHA A CONEXÃO
    connection.end();

    return NextResponse.json({ folders: folderList });

  } catch (error) {
    console.error('Erro IMAP Folders:', error);
    // Tenta fechar se deu erro no meio
    if (connection) {
        try { connection.end(); } catch(e) {}
    }
    
    return NextResponse.json({ 
      error: 'Falha ao buscar pastas.', 
      details: error.message 
    }, { status: 500 });
  }
}