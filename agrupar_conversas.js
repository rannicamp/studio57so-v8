const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';

function getCanonicalPhone(phone) {
    if (!phone) return null;
    let digits = String(phone).replace(/[^0-9]/g, '');
    let len = digits.length;
    if (len < 10) return digits;
    
    let core = digits.slice(-8);
    let ddd;
    if (len % 2 !== 0) { 
        ddd = digits.slice(-11, -9);
    } else {
        ddd = digits.slice(-10, -8);
    }
    return `${ddd}${core}`;
}

async function main() {
    const client = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    try {
        console.log("Iniciando agrupamento de conversas via telefone canônico...");
        
        // 1. Pega todas as mensagens
        const msgs = await client.query(`
            SELECT id, contato_id, sender_id, receiver_id, organizacao_id, created_at, conversation_record_id
            FROM whatsapp_messages
        `);
        console.log(`Lidas ${msgs.rows.length} mensagens.`);
        
        let processedCount = 0;
        let createdConversations = 0;
        
        // Cache de conversas ativas para não ficar indo no banco à toa (key = orgId_contatoId_canonicalPhone)
        const activeConversations = new Map();
        
        // Pré-carrega as conversas existentes
        const convs = await client.query(`SELECT id, organizacao_id, contato_id, phone_number FROM whatsapp_conversations`);
        for (let c of convs.rows) {
            const canonical = getCanonicalPhone(c.phone_number);
            if (canonical) {
                activeConversations.set(`${c.organizacao_id}_${c.contato_id}_${canonical}`, c.id);
            }
        }
        console.log(`Pré-carregadas ${activeConversations.size} conversas existentes mapeadas canonicamente.`);

        for (let msg of msgs.rows) {
            // Descobre o número do cliente na mensagem (o que não for do sistema Elo57)
            // Assumimos que o Elo57 manda como sender_id um número longo de business API, mas se for inbound, sender_id é o cliente.
            // Para simplificar, testamos ambos e usamos o que der um telefone BR válido e bater com o contato.
            // Mas pera, só de saber que um dos lados tem 10+ dígitos já é suficiente.
            // Melhor: o número do cliente geralmente é o que tem o CanonicalPhone mapeado no contato.
            
            let targetPhone = msg.direction === 'inbound' ? msg.sender_id : (msg.receiver_id || msg.sender_id);
            // Se direction não estiver garantido, vamos achar o canonical
            let c1 = getCanonicalPhone(msg.sender_id);
            let c2 = getCanonicalPhone(msg.receiver_id);
            let canonicalPhone = c1 || c2;
            
            if (c1 && c2) {
                // Se ambos têm cara de telefone BR, prioriza o que não for o "bot/sistema".
                // Geralmente o bot tem um DDI fixo e não tem 9.
                // Na dúvida, pegamos o que for do cliente original (se message é da organização, etc)
                // Usaremos um hack: o phoneNumber que DE FATO tem o contato_id.
            }
            
            // Simplificação baseada na observação: Se o sistema usa um sender fixo, o outro é o target.
            // Vamos testar os dois.
            if (!canonicalPhone) continue;
            
            // Aqui pegamos o telefone original cru para salvar na nova conversa se precisar
            let rawPhoneToSave = getCanonicalPhone(msg.sender_id) ? msg.sender_id : msg.receiver_id;
            // Se os 2 tiverem canonical, tentamos pegar o que difere do da empresa, mas a rigor 
            // no banco as msg que importam já tem contato_id setado. Vamos usar o getCanonical de msg.sender ou receiver.
            // Pera, vamos usar o receiver se for outbound, sender se for inbound.
            // Como não buscamos direction, usamos:
            // A empresa tem sender_id = '690198827516149' (muito grande, canonical retorna null?)
            // wait: '690198827516149' length é 15. getCanonicalPhone vai pegar o slice(-8) -> 27516149. E o DDD. Isso pode dar falso positivo.
            // Correção na lógica: se começar com 55 ou ter +10 digitos.
            // Melhor buscar o telefone verdadeiro do cliente usando a tabela telefones!
            
            let clientRawPhone = null;
            if (msg.sender_id && msg.sender_id.length < 15 && msg.sender_id.startsWith('55')) clientRawPhone = msg.sender_id;
            else if (msg.receiver_id && msg.receiver_id.length < 15 && msg.receiver_id.startsWith('55')) clientRawPhone = msg.receiver_id;
            else if (msg.sender_id && msg.sender_id.length <= 13) clientRawPhone = msg.sender_id;
            else if (msg.receiver_id && msg.receiver_id.length <= 13) clientRawPhone = msg.receiver_id;
            else clientRawPhone = msg.sender_id; // fallback
            
            let canonical = getCanonicalPhone(clientRawPhone);
            
            if (!canonical || !msg.contato_id) continue;
            
            const cacheKey = `${msg.organizacao_id}_${msg.contato_id}_${canonical}`;
            let conversationId = activeConversations.get(cacheKey);
            
            if (!conversationId) {
                // Tenta achar pelo phone_number exato primeiro para evitar conflito de unique key
                const existRes = await client.query(`SELECT id FROM whatsapp_conversations WHERE phone_number = $1`, [clientRawPhone]);
                if (existRes.rows.length > 0) {
                    conversationId = existRes.rows[0].id;
                } else {
                    // Cria a conversa
                    const insRes = await client.query(`
                        INSERT INTO whatsapp_conversations (organizacao_id, contato_id, phone_number, updated_at)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (phone_number) DO UPDATE SET updated_at = EXCLUDED.updated_at
                        RETURNING id
                    `, [msg.organizacao_id, msg.contato_id, clientRawPhone, msg.created_at]);
                    
                    conversationId = insRes.rows[0].id;
                    createdConversations++;
                }
                activeConversations.set(cacheKey, conversationId);
            }
            
            if (msg.conversation_record_id !== conversationId) {
                await client.query(`
                    UPDATE whatsapp_messages SET conversation_record_id = $1 WHERE id = $2
                `, [conversationId, msg.id]);
                processedCount++;
            }
        }
        
        console.log(`Processo finalizado. Conversas criadas: ${createdConversations}. Mensagens migradas/corrigidas: ${processedCount}.`);
        
    } catch(e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
