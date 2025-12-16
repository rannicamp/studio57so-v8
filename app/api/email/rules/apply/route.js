import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// Função auxiliar para verificar condições
const checkCondition = (email, condition) => {
    const fieldMap = {
        'from': email.parts[0].body.from ? email.parts[0].body.from[0] : '',
        'subject': email.parts[0].body.subject ? email.parts[0].body.subject[0] : '',
        'body': '' // Body é pesado para baixar em lote, por enquanto focamos em header
    };

    let textToCheck = (fieldMap[condition.campo] || '').toLowerCase();
    let valueToCheck = (condition.valor || '').toLowerCase();

    switch (condition.operador) {
        case 'contains': return textToCheck.includes(valueToCheck);
        case 'not_contains': return !textToCheck.includes(valueToCheck);
        case 'equals': return textToCheck === valueToCheck;
        case 'starts_with': return textToCheck.startsWith(valueToCheck);
        case 'ends_with': return textToCheck.endsWith(valueToCheck);
        default: return false;
    }
};

export async function POST(request) {
    const supabase = createClient();
    let connection = null;

    try {
        // 1. Autenticação e Configuração
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: config } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (!config) return NextResponse.json({ error: 'Configuração de e-mail não encontrada' }, { status: 404 });

        // 2. Buscar Regras Ativas
        const { data: regras } = await supabase
            .from('email_regras')
            .select('*')
            .eq('user_id', user.id)
            .eq('ativo', true)
            .order('ordem', { ascending: true });

        if (!regras || regras.length === 0) {
            return NextResponse.json({ message: 'Sem regras ativas', processed: 0 });
        }

        // 3. Conectar no IMAP
        const imapConfig = {
            imap: {
                user: config.imap_user || config.email,
                password: config.senha_app,
                host: config.imap_host,
                port: config.imap_port || 993,
                tls: true,
                authTimeout: 10000,
                tlsOptions: { rejectUnauthorized: false }
            },
        };

        connection = await imapSimple.connect(imapConfig);
        await connection.openBox('INBOX', { readOnly: false });

        // 4. Buscar e-mails recentes (Últimos 50 para garantir performance)
        // Otimização: Buscar apenas cabeçalhos
        const searchCriteria = ['ALL']; 
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true,
            markSeen: false
        };
        
        // Pega mensagens
        let messages = await connection.search(searchCriteria, fetchOptions);
        
        // Ordena por mais recente e pega os últimos 50 (para não travar o sistema processando mil emails)
        messages.sort((a, b) => b.attributes.uid - a.attributes.uid);
        messages = messages.slice(0, 50);

        let processedCount = 0;
        let movedCount = 0;

        // 5. O Grande Loop: E-mail por E-mail vs Regra por Regra
        for (const message of messages) {
            let ruleApplied = false;

            for (const regra of regras) {
                if (ruleApplied) break; // Se já caiu numa regra, pula as próximas (ordem importa)

                // Verifica TODAS as condições da regra (Lógica AND)
                const allConditionsMet = regra.condicoes.every(cond => checkCondition(message, cond));

                if (allConditionsMet) {
                    // Executa Ações
                    for (const acao of regra.acoes) {
                        const uid = message.attributes.uid;

                        if (acao.tipo === 'move' && acao.pasta) {
                            try {
                                await connection.moveMessage(uid, acao.pasta);
                                movedCount++;
                            } catch (e) {
                                console.error(`Erro ao mover msg ${uid} para ${acao.pasta}`, e);
                            }
                        } 
                        else if (acao.tipo === 'markRead') {
                            await connection.addFlags(uid, '\\Seen');
                        }
                        else if (acao.tipo === 'delete' || acao.tipo === 'trash') {
                            await connection.addFlags(uid, '\\Deleted');
                        }
                    }
                    ruleApplied = true;
                    processedCount++;
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            processed: processedCount, 
            moved: movedCount,
            message: `Regras aplicadas. ${processedCount} e-mails processados.` 
        });

    } catch (error) {
        console.error('Erro no motor de regras:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try { connection.end(); } catch (e) {}
        }
    }
}