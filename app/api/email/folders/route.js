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
    if (accountId && accountId !== 'undefined' && accountId !== 'null') {
        query = query.eq('id', accountId);
    }
    
    const { data: configs } = await query;
    const config = configs?.[0]; 

    if (!config) {
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
        authTimeout: 30000, // Aumentei para garantir tempo de contar
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

    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            const delimiter = value.delimiter || '/';
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

            // Ignora container do Gmail
            if (key === '[Gmail]' || key === '[Google Mail]') {
                if (value.children) processBoxes(value.children, fullPath, level);
                continue; 
            }

            // Verifica se é selecionável
            const attribs = value.attribs || [];
            const canSelect = !attribs.some(a => typeof a === 'string' && a.toUpperCase().includes('NOSELECT'));

            folderList.push({
                name: key,
                displayName: displayName,
                path: fullPath,
                delimiter: delimiter,
                level: level,
                unseen: 0,
                canSelect: canSelect,
                accountId: config.id
            });
            
            if (value.children) {
                processBoxes(value.children, fullPath, level + 1);
            }
        }
    };

    processBoxes(boxes);

    // 6. BUSCA CONTADORES (O SEGREDO ESTÁ AQUI)
    // Percorre cada pasta e pede o status de "UNSEEN" (não lidos)
    for (const folder of folderList) {
        if (folder.canSelect) {
            try {
                // O comando status é leve e pega apenas metadados
                const status = await connection.status(folder.path, { unseen: true });
                // Garante que seja um número
                folder.unseen = Number(status.unseen) || 0;
            } catch (err) {
                console.error(`Erro ao contar pasta ${folder.path}:`, err.message);
                folder.unseen = 0;
            }
        }
    }

    // 7. Ordenação
    const specialOrder = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Spam', 'Lixeira', 'Arquivados'];
    folderList.sort((a, b) => {
        let indexA = specialOrder.indexOf(a.displayName);
        let indexB = specialOrder.indexOf(b.displayName);
        
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