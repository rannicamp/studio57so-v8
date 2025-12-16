import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

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
    
    // Parâmetros para paginação
    const { ruleId, cursor, limit = 50 } = body; 

    if (!ruleId) return NextResponse.json({ error: 'ID da regra obrigatório' }, { status: 400 });

    let connection = null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. Configs e Regra
        const { data: config } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).single();
        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

        const { data: regra } = await supabase.from('email_regras').select('*').eq('id', ruleId).single();
        if (!regra) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 });

        // 2. Conectar
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
        
        // CORREÇÃO AQUI: Pegamos o 'box' diretamente na abertura
        const box = await connection.openBox('INBOX', { readOnly: false });
        const totalMessages = box.messages.total; // O total já vem aqui!

        // 3. Calcular Faixa de Busca (Paginação Reversa)
        if (totalMessages === 0) {
            return NextResponse.json({ success: true, processed: 0, moved: 0, done: true, totalMessages: 0 });
        }

        // Se não veio cursor, começa do total (mais recente)
        let high = cursor ? Math.min(cursor, totalMessages) : totalMessages;
        let low = Math.max(1, high - limit + 1); // Garante que não desça abaixo de 1

        // Se high < 1, acabou
        if (high < 1) {
             return NextResponse.json({ success: true, processed: 0, moved: 0, done: true, totalMessages });
        }

        const range = `${low}:${high}`; // Ex: "4951:5000"
        
        // 4. Buscar Lote Específico
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true,
            markSeen: false
        };
        
        const messages = await connection.search([range], fetchOptions);
        
        // Processar do mais novo para o mais antigo
        messages.sort((a, b) => b.attributes.uid - a.attributes.uid);

        let processedCount = 0;
        let movedCount = 0;

        for (const message of messages) {
            const allConditionsMet = regra.condicoes.every(cond => checkCondition(message, cond));

            if (allConditionsMet) {
                for (const acao of regra.acoes) {
                    const uid = message.attributes.uid;
                    try {
                        if (acao.tipo === 'move' && acao.pasta) {
                            await connection.moveMessage(uid, acao.pasta);
                            movedCount++;
                        } 
                        else if (acao.tipo === 'markRead') await connection.addFlags(uid, '\\Seen');
                        else if (acao.tipo === 'delete' || acao.tipo === 'trash') await connection.addFlags(uid, '\\Deleted');
                    } catch (e) { console.error(`Erro ação msg ${uid}:`, e); }
                }
            }
            processedCount++; // Conta quantos analisamos (matches ou não)
        }

        // 5. Retornar Estado para o Próximo Loop
        const nextCursor = low - 1;
        const done = nextCursor < 1;

        return NextResponse.json({ 
            success: true, 
            matched: processedCount, // Quantos foram lidos neste lote
            moved: movedCount,       // Quantos sofreram ação
            nextCursor: nextCursor,
            totalMessages: totalMessages,
            done: done,
            currentRange: range
        });

    } catch (error) {
        console.error('Erro Deep Scan:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) try { connection.end(); } catch (e) {}
    }
}