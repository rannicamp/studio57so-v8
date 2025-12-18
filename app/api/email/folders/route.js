import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId'); // <--- A MÁGICA AQUI

  let connection = null;

  try {
    // 1. Verificar Autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 2. Buscar Configuração (Da conta específica ou da primeira que achar)
    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    
    if (accountId) {
        query = query.eq('id', accountId);
    }
    
    // Pega a conta específica (ou a primeira/única se não passar ID, pra compatibilidade)
    const { data: configs, error } = await query;
    const config = configs?.[0];

    if (error || !config) {
      // Se não achou conta, retornamos lista vazia mas sem erro 500, para a UI não quebrar
      return NextResponse.json({ folders: [] }); 
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

    // 4. Mapeamento de Nomes
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

    // 5. Função Recursiva
    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            const delimiter = value.delimiter || '/';
            const fullPath = parentPath ? `${parentPath}${delimiter}${key}` : key;

            let displayName = key;
            const upperKey = key.toUpperCase();
            
            if (folderTranslations[upperKey]) {
                displayName = folderTranslations[upperKey];
            } else if (key.toUpperCase().includes('SEND') || key.toUpperCase().includes('SENT')) {
                 displayName = 'Enviados';
            }

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
                unseen: 0,
                accountId: config.id // <--- Importante: Marcamos de qual conta é essa pasta
            });
            
            if (value.children) {
                processBoxes(value.children, fullPath, level + 1);
            }
        }
    };

    processBoxes(boxes);

    // 6. Busca Contadores (Unseen)
    try {
        await Promise.all(folderList.map(async (folder) => {
            try {
                const status = await connection.status(folder.path, { unseen: true });
                folder.unseen = status.unseen || 0;
            } catch (err) { folder.unseen = 0; }
        }));
    } catch (e) { console.error("Erro contadores:", e); }

    // 7. Ordenação
    const specialOrder = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Spam', 'Lixeira', 'Arquivados'];
    folderList.sort((a, b) => {
        const indexA = specialOrder.indexOf(a.displayName);
        const indexB = specialOrder.indexOf(b.displayName);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.path.localeCompare(b.path);
    });

    return NextResponse.json({ folders: folderList, accountId: config.id });

  } catch (error) {
    console.error('Erro IMAP Folders:', error);
    return NextResponse.json({ error: 'Falha ao buscar pastas.', details: error.message }, { status: 500 });
  } finally {
    if (connection) try { connection.end(); } catch(e) {}
  }
}