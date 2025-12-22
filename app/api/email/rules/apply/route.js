import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// --- MESMO DECODIFICADOR DO RUN/ROUTE.JS ---
const decodeHeaderValue = (str) => {
    if (!str) return '';
    if (Array.isArray(str)) str = str[0];
    if (!str || typeof str !== 'string') return ''; 
    
    const unfolded = str.replace(/\r\n\s+/g, ' ');
    const encodedWordRegex = /=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g;

    if (!encodedWordRegex.test(unfolded)) return unfolded.replace(/^"|"$/g, '').trim();

    return unfolded.replace(encodedWordRegex, (match, charset, encoding, content) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                return Buffer.from(content, 'base64').toString('utf8');
            } else if (encoding.toUpperCase() === 'Q') {
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

export async function POST(request) {
    const supabase = await createClient();
    let connection = null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: config } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).single();
        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

        const { data: regras } = await supabase
            .from('email_regras')
            .select('*')
            .eq('user_id', user.id)
            .eq('ativo', true)
            .order('ordem', { ascending: true });

        if (!regras || regras.length === 0) return NextResponse.json({ message: 'Sem regras ativas', processed: 0 });

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
        await connection.openBox('INBOX', { readOnly: false });

        // AUMENTO DE ESCOPO: Pega 50 mensagens para garantir
        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true,
            markSeen: false
        };
        
        let messages = await connection.search(searchCriteria, fetchOptions);
        
        // Ordena por UID decrescente (mais novos primeiro) e pega os top 50
        messages.sort((a, b) => b.attributes.uid - a.attributes.uid);
        messages = messages.slice(0, 50);

        let processedCount = 0;
        let movedCount = 0;

        for (const message of messages) {
            let ruleApplied = false;

            for (const regra of regras) {
                if (ruleApplied) break; 

                try {
                    if (regra.condicoes.length > 0 && regra.condicoes.every(cond => checkCondition(message, cond))) {
                        const uid = message.attributes.uid;
                        
                        for (const acao of regra.acoes) {
                            // LOGICA DE HONESTIDADE: Só conta se não der erro
                            try {
                                if (acao.tipo === 'move' && acao.pasta) {
                                    await connection.moveMessage(uid, acao.pasta);
                                    movedCount++; // Só incrementa se passar por essa linha sem erro
                                } 
                                else if (acao.tipo === 'markRead') {
                                    await connection.addFlags(uid, '\\Seen');
                                }
                                else if (acao.tipo === 'delete') {
                                    try { await connection.moveMessage(uid, 'TRASH'); } 
                                    catch { await connection.addFlags(uid, '\\Deleted'); }
                                    movedCount++;
                                }
                            } catch (actionError) {
                                console.error(`Falha na ação da regra para msg ${uid}:`, actionError);
                                // Não incrementa movedCount se der erro
                            }
                        }
                        ruleApplied = true;
                    }
                } catch (err) {
                    console.error("Erro processando regra na msg " + message.attributes.uid, err);
                }
            }
            processedCount++;
        }

        return NextResponse.json({ 
            success: true, 
            processed: processedCount, 
            moved: movedCount,
            message: `Regras aplicadas.` 
        });

    } catch (error) {
        console.error('Erro no motor de regras (apply):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try { connection.end(); } catch (e) {}
        }
    }
}