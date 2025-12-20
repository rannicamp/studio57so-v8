import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

function getDisplayName(name, path) {
    const n = name.toUpperCase();
    const p = path.toUpperCase();
    
    if (n === 'INBOX') return 'Caixa de Entrada';
    if (n === 'DRAFTS' || p.includes('DRAFT') || p.includes('RASCUNHO')) return 'Rascunhos';
    if (n === 'SENT' || n === 'SENT ITEMS' || p.includes('SENT') || p.includes('ENVIAD')) return 'Enviados';
    if (n === 'TRASH' || n === 'DELETED ITEMS' || p.includes('TRASH') || p.includes('LIXEIRA') || p.includes('DELETED')) return 'Lixeira';
    if (n === 'JUNK' || n === 'SPAM' || p.includes('SPAM') || p.includes('JUNK')) return 'Spam';
    if (n === 'ARCHIVE' || p.includes('ARCHIVE') || p.includes('ARQUIVO')) return 'Arquivados';
    
    return name;
}

function isSystemFolder(name) {
    const n = name.toUpperCase();
    return [
        'SENT', 'SENT ITEMS', 'ENVIADOS', 
        'DRAFTS', 'RASCUNHOS', 
        'TRASH', 'DELETED ITEMS', 'LIXEIRA', 
        'JUNK', 'SPAM', 
        'ARCHIVE', 'ARQUIVOS'
    ].some(sys => n.includes(sys));
}

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const action = searchParams.get('action'); 

  let connection = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (accountId && accountId !== 'undefined' && accountId !== 'null') {
        query = query.eq('id', accountId);
    }
    const { data: configs } = await query;
    const config = configs?.[0];

    if (!config) return NextResponse.json({ folders: [], counts: {} });

    const imapConfig = {
      imap: {
        user: config.imap_user || config.email,
        password: config.senha_app,
        host: config.imap_host,
        port: config.imap_port || 993,
        tls: true,
        authTimeout: 25000, 
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);

    // --- AÇÃO: CONTAGEM DE NÃO LIDOS ---
    if (action === 'getAllCounts') {
        const boxes = await connection.getBoxes();
        const counts = {};
        const pathsToFetch = [];
        const seenPaths = new Set();
        
        const collect = (list, parentPath = '') => {
            for (const [key, value] of Object.entries(list)) {
                if (key === '[Gmail]' || key === '[Google Mail]') { 
                    if (value.children) collect(value.children, parentPath);
                    continue;
                }
                
                const delimiter = value.delimiter || '.';
                const fullPath = parentPath ? parentPath + delimiter + key : key;
                
                if (seenPaths.has(fullPath)) {
                    if (value.children) collect(value.children, fullPath);
                    continue;
                }
                seenPaths.add(fullPath);

                const attribs = value.attribs || [];
                const isNoselect = attribs.some(a => typeof a === 'string' && a.toUpperCase().includes('NOSELECT'));
                
                if (!isNoselect) {
                    pathsToFetch.push(fullPath);
                }
                
                if (value.children) {
                    collect(value.children, fullPath);
                }
            }
        };
        collect(boxes);

        const promises = pathsToFetch.map(async (path) => {
            try {
                const status = await connection.status(path, { unseen: true });
                return { path, count: status.unseen || 0 };
            } catch (e) {
                // CORREÇÃO CRUCIAL: Retorna -1 em caso de erro, para não zerar o front
                console.warn(`Erro ao contar pasta ${path}: ${e.message}`);
                return { path, count: -1 };
            }
        });

        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                counts[result.value.path] = result.value.count;
            }
        });

        return NextResponse.json({ counts });
    }

    // --- LISTAGEM ESTRUTURAL ---
    const boxes = await connection.getBoxes();
    const folderList = [];
    const seenPaths = new Set();

    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            if (key === '[Gmail]' || key === '[Google Mail]') {
                if (value.children) processBoxes(value.children, parentPath, level);
                continue; 
            }

            if (level > 0 && key.toUpperCase() === 'INBOX') {
                if (value.children) processBoxes(value.children, parentPath, level);
                continue;
            }

            const delimiter = value.delimiter || '.';
            const fullPath = parentPath ? parentPath + delimiter + key : key;

            if (seenPaths.has(fullPath)) {
                if (value.children) {
                    const nextLevel = (parentPath.toUpperCase() === 'INBOX' && isSystemFolder(key)) ? 1 : level + 1;
                    processBoxes(value.children, fullPath, nextLevel);
                }
                continue; 
            }
            seenPaths.add(fullPath);

            let visualLevel = level;
            if (parentPath.toUpperCase() === 'INBOX' && isSystemFolder(key)) {
                visualLevel = 0; 
            }

            const attribs = value.attribs || [];
            const canSelect = !attribs.some(a => typeof a === 'string' && a.toUpperCase().includes('NOSELECT'));

            folderList.push({
                name: key,
                displayName: getDisplayName(key, fullPath),
                path: fullPath,
                delimiter: delimiter,
                level: visualLevel,
                unseen: 0,
                canSelect: canSelect,
                accountId: config.id
            });
            
            if (value.children) {
                const nextLevel = (parentPath.toUpperCase() === 'INBOX' && isSystemFolder(key)) ? 1 : level + 1;
                processBoxes(value.children, fullPath, nextLevel);
            }
        }
    };

    processBoxes(boxes);

    const specialOrder = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Spam', 'Lixeira'];
    folderList.sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        let indexA = specialOrder.indexOf(a.displayName);
        let indexB = specialOrder.indexOf(b.displayName);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        if (indexA !== indexB) return indexA - indexB;
        return a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({ folders: folderList });

  } catch (error) {
    console.error('IMAP Error:', error);
    return NextResponse.json({ error: 'Erro ao conectar no e-mail' }, { status: 500 });
  } finally {
    if (connection) {
        try { connection.end(); } catch(e) {}
    }
  }
}