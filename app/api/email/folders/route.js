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
    
    // Se passou um ID de conta específico, filtra por ele
    if (accountId && accountId !== 'undefined' && accountId !== 'null') {
        query = query.eq('id', accountId);
    }
    
    const { data: configs } = await query;
    // Pega a primeira configuração encontrada (ou a específica se filtrada)
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
        authTimeout: 30000, // Tempo seguro para conexão
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);
    const boxes = await connection.getBoxes();

    // 4. Mapeamento de Nomes (Tradução)
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

    // Função recursiva para processar pastas e subpastas (importante para Gmail)
    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            const delimiter = value.delimiter || '/';
            const fullPath = parentPath ? `${parentPath}${delimiter}${key}` : key;

            let displayName = key;
            const upperKey = key.toUpperCase();
            
            // Lógica de tradução e ícones baseada no nome
            if (folderTranslations[upperKey]) {
                displayName = folderTranslations[upperKey];
            } else if (upperKey.includes('SEND') || upperKey.includes('SENT') || upperKey.includes('ENVIAD')) {
                 displayName = 'Enviados';
            } else if (upperKey.includes('TRASH') || upperKey.includes('LIXEIRA') || upperKey.includes('BIN')) {
                 displayName = 'Lixeira';
            }

            // Ignora o container raiz do Gmail para ficar mais limpo
            if (key === '[Gmail]' || key === '[Google Mail]') {
                if (value.children) processBoxes(value.children, fullPath, level);
                continue; 
            }

            // Verifica se a pasta pode ser selecionada (clicável)
            const attribs = value.attribs || [];
            const canSelect = !attribs.some(a => typeof a === 'string' && a.toUpperCase().includes('NOSELECT'));

            folderList.push({
                name: key,
                displayName: displayName,
                path: fullPath,
                delimiter: delimiter,
                level: level,
                unseen: 0, // Começa com 0, vamos atualizar abaixo
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
    // Percorre cada pasta selecionável e pede especificamente o status "UNSEEN"
    for (const folder of folderList) {
        if (folder.canSelect) {
            try {
                // O comando status é mais leve que abrir a caixa (openBox)
                const status = await connection.status(folder.path, { unseen: true });
                folder.unseen = Number(status.unseen) || 0;
            } catch (err) {
                console.error(`Erro ao contar pasta ${folder.path}:`, err.message);
                folder.unseen = 0;
            }
        }
    }

    // 7. Ordenação para ficar bonito na tela
    const specialOrder = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Spam', 'Lixeira', 'Arquivados'];
    folderList.sort((a, b) => {
        let indexA = specialOrder.indexOf(a.displayName);
        let indexB = specialOrder.indexOf(b.displayName);
        
        // Tenta achar pelo nome original se não achou pelo display name
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
    // Garante que a conexão feche para não travar o servidor
    if (connection) {
        try { connection.end(); } catch(e) {}
    }
  }
}