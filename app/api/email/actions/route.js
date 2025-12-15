import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function POST(request) {
  const supabase = createClient();
  const body = await request.json();
  const { action, folder, uid } = body; // folder aqui é o path completo

  if (!action || !folder || !uid) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  let connection = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

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
    
    // Abre a pasta atual (onde o email está)
    await connection.openBox(folder, { readOnly: false });

    // --- LÓGICA DAS AÇÕES ---
    if (action === 'markAsRead') {
        await connection.addFlags(uid, '\\Seen');
    } 
    else if (action === 'markAsUnread') {
        await connection.delFlags(uid, '\\Seen');
    }
    else if (action === 'trash' || action === 'archive') {
        // Para mover, precisamos descobrir o nome da pasta de destino no servidor
        const boxes = await connection.getBoxes();
        let targetFolder = null;

        // Função auxiliar para achar pasta por nome comum (ex: Trash, Lixeira, Bin)
        const findFolder = (keywords) => {
            const traverse = (list, parent = '') => {
                for (const [key, value] of Object.entries(list)) {
                    const fullPath = parent ? `${parent}${value.delimiter}${key}` : key;
                    if (keywords.some(k => key.toUpperCase().includes(k))) return fullPath;
                    if (value.children) {
                        const found = traverse(value.children, fullPath);
                        if (found) return found;
                    }
                }
                return null;
            };
            return traverse(boxes);
        };

        if (action === 'trash') {
            targetFolder = findFolder(['TRASH', 'LIXEIRA', 'BIN', 'DELETED']);
        } else if (action === 'archive') {
            targetFolder = findFolder(['ARCHIVE', 'ARQUIVO', 'ALL MAIL', 'TODOS']);
        }

        if (targetFolder) {
            // Move o e-mail
            await connection.moveMessage(uid, targetFolder);
        } else {
            // Se não achar a pasta, apenas deleta (marca como deleted) se for trash
            if (action === 'trash') {
                await connection.addFlags(uid, '\\Deleted');
            } else {
                throw new Error(`Pasta de destino para ${action} não encontrada.`);
            }
        }
    }
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro na ação de e-mail:', error);
    return NextResponse.json({ error: 'Falha ao processar ação: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
        try { connection.end(); } catch (e) {}
    }
  }
}