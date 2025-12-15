import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function GET() {
  const supabase = createClient();

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

    const connection = await imapSimple.connect(imapConfig);
    const boxes = await connection.getBoxes();
    connection.end();

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

    // 5. Função Recursiva Poderosa (Corrige o Path e adiciona Nível)
    // parentPath: O caminho completo acumulado até aqui
    // level: Nível de indentação (0 = raiz, 1 = filho, 2 = neto)
    const processBoxes = (boxList, parentPath = '', level = 0) => {
        for (const [key, value] of Object.entries(boxList)) {
            const delimiter = value.delimiter || '/';
            
            // CORREÇÃO CRÍTICA: Construir o caminho completo baseado no pai acumulado
            // Se tiver parentPath, soma. Se não, é o próprio key.
            const fullPath = parentPath ? `${parentPath}${delimiter}${key}` : key;

            // Tratamento do Nome de Exibição
            let displayName = key;
            const upperKey = key.toUpperCase();
            
            // Se for pasta padrão, usa a tradução. Senão, mantém o nome original.
            if (folderTranslations[upperKey]) {
                displayName = folderTranslations[upperKey];
            } else if (key.toUpperCase().includes('SEND') || key.toUpperCase().includes('SENT')) {
                // Captura variações como "Sent Items"
                 displayName = 'Enviados';
            }

            // Ignorar pastas de sistema estranhas ou desnecessárias (Opcional)
            if (key.startsWith('[Gmail]')) {
                // No Gmail, as pastas reais estão DENTRO dessa, então só processamos os filhos
                if (value.children) processBoxes(value.children, fullPath, level);
                continue; 
            }

            folderList.push({
                name: key,             // Nome técnico curto (ex: "Work")
                displayName: displayName, // Nome bonito (ex: "Trabalho")
                path: fullPath,        // O CAMINHO CORRETO PARA ABRIR A PASTA (ex: "INBOX.Trabalho")
                delimiter: delimiter,
                attribs: value.attribs,
                level: level,          // Para indentação visual no front
                special: !!folderTranslations[upperKey] // Flag para ícones especiais
            });
            
            // Recursão: Passa o fullPath atual como pai para os filhos
            if (value.children) {
                processBoxes(value.children, fullPath, level + 1);
            }
        }
    };

    processBoxes(boxes);

    // 6. Ordenação Inteligente
    // Coloca Caixa de Entrada no topo, depois as especiais, depois as pastas normais alfabeticamente
    const specialOrder = ['Caixa de Entrada', 'Enviados', 'Rascunhos', 'Spam', 'Lixeira', 'Arquivados'];

    folderList.sort((a, b) => {
        const indexA = specialOrder.indexOf(a.displayName);
        const indexB = specialOrder.indexOf(b.displayName);

        // Se ambos são especiais, ordena pela lista fixa
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // Se só A é especial, ele sobe
        if (indexA !== -1) return -1;
        // Se só B é especial, ele sobe
        if (indexB !== -1) return 1;

        // Se nenhum é especial, ordena alfabeticamente, mas respeitando grupos de hierarquia se possível
        // (Aqui mantemos simples por path para agrupar pai/filho visualmente na lista plana)
        return a.path.localeCompare(b.path);
    });

    return NextResponse.json({ folders: folderList });

  } catch (error) {
    console.error('Erro IMAP Folders:', error);
    return NextResponse.json({ 
      error: 'Falha ao buscar pastas.', 
      details: error.message 
    }, { status: 500 });
  }
}