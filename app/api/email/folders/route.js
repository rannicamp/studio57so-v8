import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId'); 

  let connection = null;

  try {
    // 1. Verificar Autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 2. Buscar Configuração
    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (accountId && accountId !== 'undefined') {
        query = query.eq('id', accountId);
    }
    
    const { data: configs } = await query;
    const config = configs?.[0]; 

    if (!config) {
      // Retorna array vazio em vez de erro 404 para não quebrar a UI
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
        authTimeout: 20000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);
    const boxes = await connection.getBoxes();

    // 4. Mapeamento
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

    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            const delimiter = value.delimiter || '/';
            // O caminho completo deve respeitar o delimitador do servidor
            const fullPath = parentPath ? `${parentPath}${delimiter}${key}` : key;

            let displayName = key;
            const upperKey = key.toUpperCase();
            
            if (folderTranslations[upperKey]) {
                displayName = folderTranslations[upperKey];
            } else if (upperKey.includes('SEND') || upperKey.includes('SENT') || upperKey.includes('ENVIAD')) {
                 displayName = 'Enviados';
            } else if (upperKey.includes('TRASH') || upperKey.includes('LIXEIRA') || upperKey.includes('BIN')) {
                 displayName = 'Lixeira';
            }

            // Ignora pastas "virtuais" do Gmail que não são clicáveis
            if (key === '[Gmail]' && value.children) {
                processBoxes(value.children, fullPath, level);
                continue; 
            }

            folderList.push({
                name: key,
                displayName: displayName,
                path: fullPath,
                delimiter: delimiter,
                level: level,
                unseen: 0,
                accountId: config.id
            });
            
            if (value.children) {
                processBoxes(value.children, fullPath, level + 1);
            }
        }
    };

    processBoxes(boxes);

    // 6. BUSCA CONTADORES (STATUS)
    // Fazemos isso em paralelo, mas com tratamento de erro individual
    await Promise.all(folderList.map(async (folder) => {
        try {
            // Apenas buscamos contagem para pastas "reais" (não contêineres vazios)
            // O comando STATUS retorna: messages, recent, unseen, uidnext, uidvalidity
            const status = await connection.status(folder.path, { unseen: true });
            folder.unseen = status.unseen || 0;
        } catch (err) {
            // Se falhar (ex: pasta não selecionável), assume 0 e segue a vida
            // console.warn(`Não foi possível ler status da pasta ${folder.path}:`, err.message);
            folder.unseen = 0;
        }
    }));

    // 7. Ordenação Inteligente
    const specialOrder = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Spam', 'Lixeira', 'Arquivados'];
    
    folderList.sort((a, b) => {
        // Verifica prioridade por DisplayName
        let indexA = specialOrder.indexOf(a.displayName);
        let indexB = specialOrder.indexOf(b.displayName);
        
        // Se não achou pelo display name, tenta pelo nome original (caso de servidores em ingles)
        if (indexA === -1) indexA = specialOrder.findIndex(s => a.name.toUpperCase().includes(s.toUpperCase()));
        if (indexB === -1) indexB = specialOrder.findIndex(s => b.name.toUpperCase().includes(s.toUpperCase()));

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        
        return a.path.localeCompare(b.path);
    });

    return NextResponse.json({ folders: folderList });

  } catch (error) {
    console.error('Erro IMAP Folders:', error);
    return NextResponse.json({ error: 'Falha ao buscar pastas.' }, { status: 500 });
  } finally {
    if (connection) {
        try { connection.end(); } catch(e) {}
    }
  }
}