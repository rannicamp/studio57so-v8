import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function GET() {
  const supabase = createClient();

  try {
    // 1. Verificar quem é o usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 2. Buscar as configurações de e-mail dele no banco
    const { data: config, error } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: 'E-mail não configurado' }, { status: 404 });
    }

    // 3. Configurar a conexão IMAP (Hostinger/Titan/Gmail)
    const imapConfig = {
      imap: {
        user: config.imap_user || config.email,
        password: config.senha_app, // A senha que você salvou no modal
        host: config.imap_host,
        port: config.imap_port || 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false } // Importante para compatibilidade
      },
    };

    // 4. Conectar e buscar a lista de caixas (pastas)
    const connection = await imapSimple.connect(imapConfig);
    const boxes = await connection.getBoxes();
    
    connection.end(); // Fecha a conexão rapidinho

    // 5. Organizar os dados para mostrar na tela
    const folderList = [];
    
    // Função recursiva para pegar subpastas se houver
    const processBoxes = (boxList, parent = null) => {
        for (const [key, value] of Object.entries(boxList)) {
            // Filtra pastas de sistema ocultas se necessário
            folderList.push({
                name: key, // Ex: "INBOX", "Sent"
                path: parent ? `${parent}${value.delimiter}${key}` : key,
                delimiter: value.delimiter,
                attribs: value.attribs
            });
            
            if (value.children) {
                processBoxes(value.children, key);
            }
        }
    };

    processBoxes(boxes);

    // Ordena para INBOX ficar sempre em primeiro
    folderList.sort((a, b) => {
        if (a.name.toUpperCase() === 'INBOX') return -1;
        if (b.name.toUpperCase() === 'INBOX') return 1;
        return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ folders: folderList });

  } catch (error) {
    console.error('Erro IMAP:', error);
    return NextResponse.json({ 
      error: 'Falha ao conectar. Verifique servidor e senha.', 
      details: error.message 
    }, { status: 500 });
  }
}