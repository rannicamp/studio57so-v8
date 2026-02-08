import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// ... (Funções decodeHeaderValue e checkCondition MANTIDAS IGUAIS AO ANTERIOR) ...
const decodeHeaderValue = (str) => {
    if (!str) return '';
    if (Array.isArray(str)) str = str[0];
    if (!str || typeof str !== 'string') return ''; 
    const unfolded = str.replace(/\r\n\s+/g, ' ');
    const encodedWordRegex = /=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g;
    if (!encodedWordRegex.test(unfolded)) return unfolded.replace(/^"|"$/g, '').trim();
    return unfolded.replace(encodedWordRegex, (match, charset, encoding, content) => {
        try {
            if (encoding.toUpperCase() === 'B') return Buffer.from(content, 'base64').toString('utf8');
            else if (encoding.toUpperCase() === 'Q') {
                let decoded = content.replace(/_/g, ' ');
                decoded = decoded.replace(/=([0-9A-F]{2})/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
                try { return decodeURIComponent(escape(decoded)); } catch { return decoded; }
            }
            return match;
        } catch (err) { return match; }
    });
};

const checkCondition = (email, condition) => {
    const part = email.parts.find(p => p.which && p.which.toUpperCase().includes('HEADER'));
    const headers = part?.body || {};
    const rawFrom = headers.from || headers.FROM || headers.From || [];
    const rawSubject = headers.subject || headers.SUBJECT || headers.Subject || [];
    const rawTo = headers.to || headers.TO || headers.To || [];
    const fieldMap = {
        'from': decodeHeaderValue(rawFrom).toLowerCase(),
        'subject': decodeHeaderValue(rawSubject).toLowerCase(),
        'to': decodeHeaderValue(rawTo).toLowerCase()
    };
    const textToCheck = fieldMap[condition.campo] || '';
    const valueToCheck = (condition.valor || '').toLowerCase();
    if (!valueToCheck) return true; 
    if (!textToCheck) return false;
    switch (condition.operador) {
        case 'contains': return textToCheck.includes(valueToCheck);
        case 'not_contains': return !textToCheck.includes(valueToCheck);
        case 'equals': return textToCheck === valueToCheck;
        case 'starts_with': return textToCheck.startsWith(valueToCheck);
        case 'ends_with': return textToCheck.endsWith(valueToCheck);
        default: return false;
    }
};

async function processAccountBatch(config, regras, depth, limit) {
    let connection = null;
    let stats = { matched: 0, moved: 0, totalMessages: 0, hasMore: false };

    try {
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
        const box = await connection.openBox('INBOX', { readOnly: false });
        stats.totalMessages = box.messages.total;

        if (stats.totalMessages === 0) {
            connection.end();
            return stats;
        }

        let currentEnd = stats.totalMessages - depth;
        let currentStart = Math.max(1, currentEnd - limit + 1);

        if (currentEnd < 1) {
            connection.end();
            return stats;
        }
        
        stats.hasMore = currentStart > 1;

        const fetchRange = `${currentStart}:${currentEnd}`;
        const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], struct: true, markSeen: false };

        const messages = await connection.search([fetchRange], fetchOptions);
        messages.sort((a, b) => b.attributes.uid - a.attributes.uid);

        for (const message of messages) {
            let ruleApplied = false;
            for (const regra of regras) {
                if (ruleApplied) break; 
                try {
                    if (regra.condicoes.length > 0 && regra.condicoes.every(cond => checkCondition(message, cond))) {
                        const uid = message.attributes.uid;
                        for (const acao of regra.acoes) {
                            if (acao.tipo === 'move' && acao.pasta) {
                                await connection.moveMessage(uid, acao.pasta);
                                stats.moved++;
                            } else if (acao.tipo === 'markRead') {
                                await connection.addFlags(uid, '\\Seen');
                            } else if (acao.tipo === 'delete') {
                                try { await connection.moveMessage(uid, 'TRASH'); } 
                                catch { await connection.addFlags(uid, '\\Deleted'); }
                                stats.moved++;
                            }
                        }
                        stats.matched++;
                        ruleApplied = true;
                    }
                } catch (err) {}
            }
        }
    } catch (e) {
        console.error(`Erro deep scan conta ${config.email}:`, e.message);
    } finally {
        if (connection) try { connection.end(); } catch (e) {}
    }
    return stats;
}

export async function POST(request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { ruleId, cursor = 0, limit = 50 } = body; 
        const currentDepth = parseInt(cursor);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. Busca TODAS as contas do usuário
        const { data: allConfigs } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        if (!allConfigs || allConfigs.length === 0) return NextResponse.json({ error: 'Sem contas' }, { status: 404 });

        // 2. Busca as regras
        let query = supabase.from('email_regras').select('*').eq('user_id', user.id).eq('ativo', true);
        if (ruleId) query = query.eq('id', ruleId);
        else query = query.order('ordem', { ascending: true });

        const { data: regras } = await query;
        if (!regras || regras.length === 0) return NextResponse.json({ message: 'Sem regras.', done: true });

        // 3. Lógica Inteligente de Seleção de Contas
        let accountsToProcess = [];

        if (ruleId) {
            // Se for UMA regra específica, descobrimos de qual conta ela é
            const regraAlvo = regras[0];
            if (regraAlvo.account_id) {
                // Filtra apenas a conta dona da regra
                accountsToProcess = allConfigs.filter(c => c.id === regraAlvo.account_id);
            } else {
                // Fallback: se a regra não tiver conta (legado), roda em todas
                accountsToProcess = allConfigs;
            }
        } else {
            // Se for varredura geral (todas as regras), roda em todas as contas
            accountsToProcess = allConfigs;
        }

        // 4. Executa
        const results = await Promise.all(accountsToProcess.map(cfg => {
            // Filtra regras que pertencem a essa conta (ou regras sem dono/legado)
            const regrasDestaConta = regras.filter(r => !r.account_id || r.account_id === cfg.id);
            return processAccountBatch(cfg, regrasDestaConta, currentDepth, limit);
        }));

        const totalMessagesMax = Math.max(...results.map(r => r.totalMessages || 0));
        const matched = results.reduce((acc, r) => acc + (r.matched || 0), 0);
        const moved = results.reduce((acc, r) => acc + (r.moved || 0), 0);
        const anyAccountHasMore = results.some(r => r.hasMore);

        return NextResponse.json({ 
            success: true, 
            done: !anyAccountHasMore, 
            nextCursor: currentDepth + limit, 
            totalMessages: totalMessagesMax, 
            matched,
            moved
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}