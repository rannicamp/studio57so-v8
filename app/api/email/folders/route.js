import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// Função auxiliar para nomes amigáveis
function getDisplayName(name, path) {
    const n = name.toUpperCase();
    const p = path.toUpperCase();
    
    // Tratamento visual para nomes comuns
    if (n === 'INBOX') return 'Caixa de Entrada';
    if (n === 'DRAFTS' || p.includes('DRAFT') || p.includes('RASCUNHO')) return 'Rascunhos';
    if (n === 'SENT' || n === 'SENT ITEMS' || p.includes('SENT') || p.includes('ENVIAD')) return 'Enviados';
    if (n === 'TRASH' || n === 'DELETED ITEMS' || p.includes('TRASH') || p.includes('LIXEIRA') || p.includes('DELETED')) return 'Lixeira';
    if (n === 'JUNK' || n === 'SPAM' || p.includes('SPAM') || p.includes('JUNK')) return 'Spam';
    if (n === 'ARCHIVE' || p.includes('ARCHIVE') || p.includes('ARQUIVO')) return 'Arquivados';
    
    return name;
}

// Identifica pastas de sistema para ordenação visual
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

// Helper seguro para pegar status da caixa (contagem de não lidos)
const getBoxStatus = (connection, boxName) => {
    return new Promise((resolve) => {
        connection.imap.status(boxName, (err, box) => {
            if (err) resolve(null);
            else resolve(box);
        });
    });
};

export async function GET(request) {
  // AWAIT OBRIGATÓRIO (Next.js 15)
  const supabase = await createClient();
  
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const action = searchParams.get('action'); 

  let connection = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // Buscar configurações da conta de e-mail no Supabase
    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (accountId && accountId !== 'undefined' && accountId !== 'null') {
        query = query.eq('id', accountId);
    }
    const { data: configs } = await query;
    const config = configs?.[0];

    if (!config) return NextResponse.json({ folders: [], counts: {} });

    // Configuração da conexão IMAP
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

    // --- AÇÃO 1: APENAS CONTAGEM (usado para atualizar badges) ---
    if (action === 'getAllCounts') {
        const boxes = await connection.getBoxes();
        const counts = {};
        const pathsToFetch = [];
        const seenPaths = new Set();
        
        // Função recursiva para coletar caminhos válidos para contagem
        const collect = (list, parentPath = '') => {
            for (const [key, value] of Object.entries(list)) {
                const delimiter = value.delimiter || '/'; 
                const fullPath = parentPath ? parentPath + delimiter + key : key;
                
                // Se for pasta container do Google, processa filhos mas ignora o pai
                if (key === '[Gmail]' || key === '[Google Mail]') { 
                    if (value.children) collect(value.children, fullPath);
                    continue;
                }
                
                if (seenPaths.has(fullPath)) {
                    if (value.children) collect(value.children, fullPath);
                    continue;
                }
                seenPaths.add(fullPath);

                const attribs = value.attribs || [];
                const isNoselect = attribs.some(a => typeof a === 'string' && a.toUpperCase().includes('NOSELECT'));
                
                // Só conta mensagens em pastas selecionáveis
                if (!isNoselect) {
                    pathsToFetch.push(fullPath);
                }
                
                if (value.children) {
                    collect(value.children, fullPath);
                }
            }
        };
        collect(boxes);

        // Busca status em paralelo para performance
        const promises = pathsToFetch.map(async (path) => {
            try {
                const status = await getBoxStatus(connection, path);
                return { path, count: status ? (status.unseen || 0) : -1 };
            } catch (e) {
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

    // --- AÇÃO 2: LISTAGEM ESTRUTURAL COMPLETA (usado no Menu Mover e Sidebar) ---
    const boxes = await connection.getBoxes();
    const folderList = [];
    const seenPaths = new Set();

    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            const delimiter = value.delimiter || '/';
            // Monta o caminho completo usado pelo servidor IMAP
            const fullPath = parentPath ? parentPath + delimiter + key : key;

            // Tratamento especial para containers do Gmail
            if (key === '[Gmail]' || key === '[Google Mail]') {
                if (value.children) processBoxes(value.children, fullPath, level);
                continue; 
            }

            // Evita duplicação visual de INBOX se ela vier aninhada incorretamente
            if (level > 0 && key.toUpperCase() === 'INBOX') {
                if (value.children) processBoxes(value.children, fullPath, level);
                continue;
            }

            if (seenPaths.has(fullPath)) {
                if (value.children) {
                    const nextLevel = (parentPath.toUpperCase() === 'INBOX' && isSystemFolder(key)) ? 1 : level + 1;
                    processBoxes(value.children, fullPath, nextLevel);
                }
                continue; 
            }
            seenPaths.add(fullPath);

            let visualLevel = level;
            // Ajuste visual: Se for pasta de sistema dentro da INBOX, sobe para nível raiz
            if (parentPath.toUpperCase() === 'INBOX' && isSystemFolder(key)) {
                visualLevel = 0; 
            }

            const attribs = value.attribs || [];
            // Flag crucial para o menu "Mover": diz se a pasta aceita mensagens
            const canSelect = !attribs.some(a => typeof a === 'string' && a.toUpperCase().includes('NOSELECT'));

            folderList.push({
                name: key,
                displayName: getDisplayName(key, fullPath),
                path: fullPath, // Esse é o ID real da pasta para o comando MOVE
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

    // Ordenação visual: Pastas especiais primeiro, depois alfabético
    const specialOrder = ['Caixa de Entrada', 'Rascunhos', 'Enviados', 'Spam', 'Lixeira', 'Arquivados'];
    
    folderList.sort((a, b) => {
        // Primeiro tenta ordenar por "peso" das pastas especiais
        let indexA = specialOrder.findIndex(s => a.displayName === s || a.displayName.includes(s));
        let indexB = specialOrder.findIndex(s => b.displayName === s || b.displayName.includes(s));
        
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        // Se não for especial, ordena por nível hierárquico
        if (a.level !== b.level) return a.level - b.level;
        
        // Por último, ordem alfabética
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