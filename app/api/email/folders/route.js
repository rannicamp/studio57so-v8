import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// Função auxiliar para traduzir nomes
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

// Verifica se é pasta de sistema
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
        authTimeout: 20000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);

    // --- AÇÃO: CONTAGEM ---
    if (action === 'getAllCounts') {
        const boxes = await connection.getBoxes();
        const counts = {};
        const pathsToFetch = [];
        
        // --- NOVO: Set para evitar duplicatas na contagem também ---
        const seenPaths = new Set();
        
        const collect = (list, parentPath = '') => {
            for (const [key, value] of Object.entries(list)) {
                if (key === '[Gmail]') { 
                    if (value.children) collect(value.children, parentPath);
                    continue;
                }
                
                if (parentPath && key.toUpperCase() === 'INBOX') {
                    if (value.children) collect(value.children, parentPath);
                    continue;
                }

                const delimiter = value.delimiter || '.';
                const fullPath = parentPath ? parentPath + delimiter + key : key;
                
                // Só adiciona se não vimos esse caminho ainda
                if (seenPaths.has(fullPath)) {
                    // Mesmo duplicado, precisamos checar os filhos dele
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

        const batchSize = 5;
        for (let i = 0; i < pathsToFetch.length; i += batchSize) {
            const batch = pathsToFetch.slice(i, i + batchSize);
            await Promise.all(batch.map(async (path) => {
                try {
                    const status = await connection.status(path, { unseen: true });
                    counts[path] = status.unseen || 0;
                } catch (e) {
                    counts[path] = 0;
                }
            }));
        }

        return NextResponse.json({ counts });
    }

    // --- LISTAGEM ESTRUTURAL (COM PROTEÇÃO ANTI-CLONE) ---
    const boxes = await connection.getBoxes();
    const folderList = [];
    
    // --- O PORTEIRO: Lista de caminhos já adicionados ---
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

            // --- BLOQUEIO DE DUPLICATAS ---
            // Se já processamos esse caminho exato (vindo de outro lugar da árvore), pula.
            if (seenPaths.has(fullPath)) {
                // Ainda processamos os filhos para garantir que nada se perca,
                // mas não adicionamos ESTA pasta de novo na lista.
                if (value.children) {
                    const nextLevel = (parentPath.toUpperCase() === 'INBOX' && isSystemFolder(key)) ? 1 : level + 1;
                    processBoxes(value.children, fullPath, nextLevel);
                }
                continue; 
            }
            seenPaths.add(fullPath);
            // -----------------------------

            let visualLevel = level;
            
            if (parentPath.toUpperCase() === 'INBOX') {
                if (isSystemFolder(key)) {
                    visualLevel = 0; 
                }
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