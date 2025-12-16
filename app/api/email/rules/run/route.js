import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// Função auxiliar SUPER ROBUSTA para verificar condições
const checkCondition = (message, condition) => {
    // Tenta pegar do ENVELOPE (Padrão IMAP - Mais confiável)
    const envelope = message.attributes.envelope;
    
    // Fallback: Tenta pegar do HEADER bruto (Caso envelope falhe)
    const header = message.parts && message.parts[0] && message.parts[0].body ? message.parts[0].body : {};

    let textToCheck = '';

    if (condition.campo === 'from') {
        // Estratégia 1: Envelope (Ideal)
        if (envelope && envelope.from && envelope.from[0]) {
            const name = envelope.from[0].name || '';
            const address = `${envelope.from[0].mailbox}@${envelope.from[0].host}`;
            // Monta uma string completa para a busca funcionar tanto por nome quanto por email
            // Ex: "Netflix <info@netflix.com>"
            textToCheck = `${name} ${address}`.trim();
        } 
        // Estratégia 2: Header (Reserva)
        else if (header.from) {
            textToCheck = Array.isArray(header.from) ? header.from[0] : header.from;
        }
    } 
    else if (condition.campo === 'subject') {
        textToCheck = envelope ? envelope.subject : (header.subject ? header.subject[0] : '');
    }

    // Normaliza para minúsculas para a comparação não falhar por causa de 'A' vs 'a'
    textToCheck = (textToCheck || '').toLowerCase();
    const valueToCheck = (condition.valor || '').toLowerCase();

    // Log para depuração (aparece no terminal do servidor)
    // console.log(`Checking [${condition.campo}]: "${textToCheck}" vs "${valueToCheck}" (${condition.operador})`);

    switch (condition.operador) {
        case 'contains': return textToCheck.includes(valueToCheck);
        case 'not_contains': return !textToCheck.includes(valueToCheck);
        case 'equals': return textToCheck === valueToCheck; // Cuidado: exige match exato
        case 'starts_with': return textToCheck.startsWith(valueToCheck);
        case 'ends_with': return textToCheck.endsWith(valueToCheck);
        default: return false;
    }
};

export async function POST(request) {
    const supabase = createClient();
    const body = await request.json();
    
    // Parâmetros para paginação
    const { ruleId, cursor, limit = 100 } = body; // Aumentei o default para 100

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
        
        // Abre a caixa e já pega o total
        const box = await connection.openBox('INBOX', { readOnly: false });
        const totalMessages = box.messages.total;

        // 3. Calcular Faixa de Busca (Paginação Reversa)
        if (totalMessages === 0) {
            return NextResponse.json({ success: true, matched: 0, moved: 0, done: true, totalMessages: 0 });
        }

        let high = cursor ? Math.min(cursor, totalMessages) : totalMessages;
        let low = Math.max(1, high - limit + 1);

        if (high < 1) {
             return NextResponse.json({ success: true, matched: 0, moved: 0, done: true, totalMessages });
        }

        const range = `${low}:${high}`;
        
        // 4. Buscar Lote com ENVELOPE (A Chave do Sucesso 🔑)
        // Pedimos 'ENVELOPE' explicitamente, além dos headers
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true,
            envelope: true, // <--- ISSO GARANTE QUE O 'envelope' venha preenchido
            markSeen: false
        };
        
        const messages = await connection.search([range], fetchOptions);
        
        // Ordena
        messages.sort((a, b) => b.attributes.uid - a.attributes.uid);

        let processedCount = 0; // Quantos conferimos
        let movedCount = 0;     // Quantos mexemos

        for (const message of messages) {
            // Verifica a regra
            const allConditionsMet = regra.condicoes.every(cond => checkCondition(message, cond));

            if (allConditionsMet) {
                const uid = message.attributes.uid;
                
                // Executa ações
                for (const acao of regra.acoes) {
                    try {
                        if (acao.tipo === 'move' && acao.pasta) {
                            await connection.moveMessage(uid, acao.pasta);
                            movedCount++;
                        } 
                        else if (acao.tipo === 'markRead') await connection.addFlags(uid, '\\Seen');
                        else if (acao.tipo === 'delete' || acao.tipo === 'trash') await connection.addFlags(uid, '\\Deleted');
                    } catch (e) { 
                        console.error(`Erro ação msg ${uid}:`, e); 
                    }
                }
            }
            // Independente se moveu ou não, contamos como processado/analisado
            processedCount++; 
        }

        // 5. Retornar
        const nextCursor = low - 1;
        const done = nextCursor < 1;

        return NextResponse.json({ 
            success: true, 
            matched: processedCount, 
            moved: movedCount,
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