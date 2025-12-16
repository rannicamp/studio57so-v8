import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// --- DECODIFICADOR BLINDADO V2.0 ---
const decodeHeaderValue = (str) => {
    // 1. Proteção contra nulos e indefinidos
    if (!str) return '';
    
    // 2. Normaliza Array (IMAP às vezes devolve array de strings)
    if (Array.isArray(str)) {
        str = str[0];
    }

    // 3. Verifica se sobrou string válida
    if (!str || typeof str !== 'string') return ''; 
    
    // 4. Limpeza inicial
    const unfolded = str.replace(/\r\n\s+/g, ' ');
    
    // 5. Regex para detectar codificações MIME (ex: =?utf-8?B?xyz?=)
    const encodedWordRegex = /=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g;

    if (!encodedWordRegex.test(unfolded)) {
        return unfolded.replace(/^"|"$/g, '').trim();
    }

    // 6. Decodificação Robusta
    return unfolded.replace(encodedWordRegex, (match, charset, encoding, content) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                return Buffer.from(content, 'base64').toString('utf8');
            } else if (encoding.toUpperCase() === 'Q') {
                let decoded = content.replace(/_/g, ' ');
                decoded = decoded.replace(/=([0-9A-F]{2})/gi, (m, hex) => 
                    String.fromCharCode(parseInt(hex, 16))
                );
                try { return decodeURIComponent(escape(decoded)); } catch { return decoded; }
            }
            return match;
        } catch (err) { return match; }
    });
};

// --- VERIFICADOR DE CONDIÇÕES ---
const checkCondition = (email, condition) => {
    // Busca o header dentro das partes retornadas pelo IMAP
    const part = email.parts.find(p => p.which && p.which.toUpperCase().includes('HEADER'));
    const headers = part?.body || {};

    // Extração segura dos campos
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

    // Se a regra estiver vazia, ignora
    if (!valueToCheck) return true; 
    if (!textToCheck) return false;

    // Log para Debug (Ajuda a ver no terminal o que está acontecendo)
    // console.log(`[Regra Check] Campo: ${condition.campo} | Texto: "${textToCheck}" | Busca: "${valueToCheck}" | Op: ${condition.operador}`);

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
        const body = await request.json().catch(() => ({}));
        // Aceita cursor (para paginação) ou limit forçado
        const { ruleId, cursor, limit = 50 } = body; 

        // 1. Autenticação
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: config } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).single();
        if (!config) return NextResponse.json({ error: 'Configure seu e-mail.' }, { status: 404 });

        // 2. Buscar Regras
        let query = supabase.from('email_regras').select('*').eq('user_id', user.id).eq('ativo', true);
        if (ruleId) query = query.eq('id', ruleId);
        else query = query.order('ordem', { ascending: true });

        const { data: regras } = await query;
        if (!regras || regras.length === 0) {
            return NextResponse.json({ message: 'Sem regras ativas.', done: true, processed: 0 });
        }

        // 3. Conexão IMAP
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
        const totalMessages = box.messages.total;

        if (totalMessages === 0) {
            connection.end();
            return NextResponse.json({ done: true, totalMessages: 0, moved: 0 });
        }

        // 4. Paginação Reverso (Mais novos primeiro)
        // Se cursor não for passado, começa do total (mais novo)
        let currentEnd = cursor ? parseInt(cursor) : totalMessages;
        // Calcula o inicio do lote baseado no limite
        let currentStart = Math.max(1, currentEnd - limit + 1);

        if (currentEnd < 1) {
            connection.end();
            return NextResponse.json({ done: true, totalMessages, moved: 0 });
        }

        const fetchRange = `${currentStart}:${currentEnd}`;
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true,
            markSeen: false 
        };

        // Busca as mensagens do lote
        const messages = await connection.search([fetchRange], fetchOptions);
        
        // Ordena memória (decrescente UID) para processar do mais novo para o mais velho
        messages.sort((a, b) => b.attributes.uid - a.attributes.uid);

        let movedCount = 0;
        let processedCount = 0;

        // 5. Execução
        for (const message of messages) {
            let ruleApplied = false;

            for (const regra of regras) {
                // Se estamos rodando varredura geral (!ruleId) e já aplicou uma regra, para.
                // Se estamos testando uma regra específica (ruleId), continua.
                if (ruleApplied && !ruleId) break; 

                try {
                    // Verifica se TODAS as condições batem
                    const allConditionsMet = regra.condicoes.length > 0 && regra.condicoes.every(cond => checkCondition(message, cond));

                    if (allConditionsMet) {
                        const uid = message.attributes.uid;
                        console.log(`[Regra Aplicada] UID: ${uid} | Regra: ${regra.nome}`);
                        
                        for (const acao of regra.acoes) {
                            if (acao.tipo === 'move' && acao.pasta) {
                                await connection.moveMessage(uid, acao.pasta);
                                movedCount++;
                            } 
                            else if (acao.tipo === 'markRead') {
                                await connection.addFlags(uid, '\\Seen');
                            }
                            else if (acao.tipo === 'delete') {
                                // Tenta mover para lixeira primeiro
                                try {
                                    await connection.moveMessage(uid, 'TRASH');
                                } catch {
                                    try { await connection.moveMessage(uid, 'Lixeira'); }
                                    catch { await connection.addFlags(uid, '\\Deleted'); }
                                }
                                movedCount++;
                            }
                        }
                        ruleApplied = true;
                    }
                } catch (msgError) {
                    console.error(`Erro ao processar mensagem UID ${message.attributes.uid}:`, msgError);
                }
            }
            processedCount++;
        }

        return NextResponse.json({ 
            success: true, 
            done: (currentStart - 1) < 1, // Terminou se o próximo cursor for menor que 1
            nextCursor: currentStart - 1,
            totalMessages: totalMessages,
            matched: processedCount,
            moved: movedCount
        });

    } catch (error) {
        console.error('ERRO CRÍTICO ROUTE RULES:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try { connection.end(); } catch (e) {}
        }
    }
}