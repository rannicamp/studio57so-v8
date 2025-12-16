import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// Função auxiliar de verificação (mesma do motor principal)
const checkCondition = (email, condition) => {
    const fieldMap = {
        'from': email.parts[0].body.from ? email.parts[0].body.from[0] : '',
        'subject': email.parts[0].body.subject ? email.parts[0].body.subject[0] : '',
        'body': ''
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
    const body = await request.json();
    const { ruleId } = body;

    if (!ruleId) return NextResponse.json({ error: 'ID da regra obrigatório' }, { status: 400 });

    let connection = null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. Buscar Configuração
        const { data: config } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

        // 2. Buscar A REGRA ESPECÍFICA
        const { data: regra } = await supabase
            .from('email_regras')
            .select('*')
            .eq('id', ruleId)
            .single();

        if (!regra) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 });

        // 3. Conectar IMAP
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

        // 4. Buscar e-mails (Busca mais profunda: Últimos 100)
        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true,
            markSeen: false
        };
        
        let messages = await connection.search(searchCriteria, fetchOptions);
        
        // Ordena e pega os últimos 100 para garantir que pega e-mails recentes e um pouco mais antigos
        messages.sort((a, b) => b.attributes.uid - a.attributes.uid);
        messages = messages.slice(0, 100);

        let processedCount = 0;
        let movedCount = 0;

        // 5. Aplicar APENAS a regra selecionada
        for (const message of messages) {
            const allConditionsMet = regra.condicoes.every(cond => checkCondition(message, cond));

            if (allConditionsMet) {
                for (const acao of regra.acoes) {
                    const uid = message.attributes.uid;

                    if (acao.tipo === 'move' && acao.pasta) {
                        try {
                            await connection.moveMessage(uid, acao.pasta);
                            movedCount++;
                        } catch (e) { console.error(e); }
                    } 
                    else if (acao.tipo === 'markRead') {
                        await connection.addFlags(uid, '\\Seen');
                    }
                    else if (acao.tipo === 'delete' || acao.tipo === 'trash') {
                        await connection.addFlags(uid, '\\Deleted');
                    }
                }
                processedCount++;
            }
        }

        return NextResponse.json({ 
            success: true, 
            matched: processedCount, 
            moved: movedCount,
            message: `Regra executada. ${processedCount} e-mails afetados.` 
        });

    } catch (error) {
        console.error('Erro ao executar regra:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) try { connection.end(); } catch (e) {}
    }
}