import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

// --- 1. CONFIGURAÇÃO DO WEB PUSH (Para vibrar o celular) ---
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
    webPush.setVapidDetails(
        'mailto:suporte@studio57.arq.br',
        publicKey,
        privateKey
    );
}

// --- 2. INICIALIZAÇÃO DO SUPABASE (ADMIN) ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- 3. FUNÇÃO DE NOTIFICAÇÃO INTELIGENTE (INTERNA) ---
async function dispatchNotification(supabaseAdmin, organizacaoId, title, message, url) {
    try {
        const { data: users } = await supabaseAdmin
            .from('usuarios')
            .select('id, preferencias_notificacao')
            .eq('organizacao_id', organizacaoId);

        if (!users || users.length === 0) return;

        const notificationsToInsert = [];
        const pushPromises = [];

        for (const user of users) {
            const prefs = user.preferencias_notificacao;
            if (prefs && prefs.comercial === false) continue;

            notificationsToInsert.push({
                user_id: user.id,
                titulo: title,
                mensagem: message,
                link: url,
                lida: false,
                organizacao_id: organizacaoId,
                created_at: new Date().toISOString()
            });

            if (publicKey && privateKey) {
                const p = supabaseAdmin
                    .from('notification_subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .then(({ data: subs }) => {
                        if (!subs || subs.length === 0) return;
                        
                        const payload = JSON.stringify({
                            title: title,
                            body: message,
                            message: message,
                            url: url,
                            icon: '/icons/icon-192x192.png',
                            tag: 'whatsapp-msg'
                        });

                        return Promise.all(subs.map(sub => 
                            webPush.sendNotification(sub.subscription_data, payload)
                                .catch(err => {
                                    if (err.statusCode === 410 || err.statusCode === 404) {
                                        supabaseAdmin.from('notification_subscriptions').delete().eq('id', sub.id).then();
                                    }
                                })
                        ));
                    });
                pushPromises.push(p);
            }
        }

        if (notificationsToInsert.length > 0) {
            await supabaseAdmin.from('notificacoes').insert(notificationsToInsert);
        }
        await Promise.allSettled(pushPromises);

    } catch (error) {
        console.error('[WhatsApp Notification Error]', error);
    }
}

// --- FUNÇÕES DE ENVIO ---
async function sendTemplateMessage(supabase, config, to, contato, templateName, language) {
    if (!templateName) return;
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const components = [{ type: 'body', parameters: [{ type: 'text', text: contato.nome || 'Cliente' }] }];
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${config.whatsapp_permanent_token}` 
            },
            body: JSON.stringify({
                messaging_product: "whatsapp", to: to, type: "template",
                template: { name: templateName, language: { code: language }, components }
            })
        });
        
        const data = await response.json();
        if (data.messages?.[0]?.id) {
            await supabase.from('whatsapp_messages').insert({
                contato_id: contato.id, message_id: data.messages[0].id, 
                sender_id: config.whatsapp_phone_number_id, receiver_id: to,
                content: `(Automação) Template: ${templateName}`, direction: 'outbound', 
                status: 'sent', sent_at: new Date().toISOString(), 
                organizacao_id: config.organizacao_id
            });
        }
    } catch (error) {
        console.error(`[Webhook] Erro ao enviar template:`, error);
    }
}

function getTextContent(message) {
    if (!message || !message.type) return null;
    if (message.type === 'text') return message.text?.body;
    if (message.type === 'interactive') return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
    return null;
}

// --- NORMALIZAÇÃO TURBINADA (Inclui Formatação) ---
function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    const sets = new Set();
    sets.add(digits);

    if (digits.startsWith('55')) {
        const ddd = digits.substring(2, 4);
        const rest = digits.substring(4); // Restante após DDD

        // Lógica para números com 9 dígitos (55 + DDD + 9 + 8)
        if (digits.length === 13) {
            // Variações limpas
            const sem55 = digits.substring(2); // 33999998888
            const sem9 = '55' + ddd + rest.substring(1); // 553399998888
            const sem55sem9 = ddd + rest.substring(1); // 3399998888
            
            sets.add(sem55);
            sets.add(sem9);
            sets.add(sem55sem9);

            // Variações FORMATADAS (Para bater com o banco sujo)
            // Ex: (33) 99999-8888
            sets.add(`(${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`);
            // Ex: (33) 9999-8888 (Sem 9)
            sets.add(`(${ddd}) ${rest.substring(1, 5)}-${rest.substring(5)}`);
        }
        
        // Lógica para números com 8 dígitos (55 + DDD + 8)
        if (digits.length === 12) {
            const sem55 = digits.substring(2); // 3399998888
            sets.add(sem55);
            // Com 9
            sets.add('55' + ddd + '9' + rest); 
            sets.add(ddd + '9' + rest);

            // Formatações
            // Ex: (33) 9999-8888
            sets.add(`(${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`);
        }
    } else {
        // Sem 55
        if (digits.length >= 10) {
            sets.add('55' + digits);
            const ddd = digits.substring(0, 2);
            const body = digits.substring(2);
            if (body.length === 9) {
                 sets.add(`(${ddd}) ${body.substring(0, 5)}-${body.substring(5)}`);
            } else if (body.length === 8) {
                 sets.add(`(${ddd}) ${body.substring(0, 4)}-${body.substring(4)}`);
            }
        }
    }
    
    return Array.from(sets);
}

// --- ROTA DE VERIFICAÇÃO ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('hub.mode') === 'subscribe' && 
        searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

// --- ROTA PRINCIPAL ---
export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        
        const { data: config } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*, organizacao_id')
            .single();

        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 500 });

        const change = body.entry?.[0]?.changes?.[0]?.value;
        if (change?.statuses) return NextResponse.json({ status: 'ok' });

        const message = change?.messages?.[0];
        if (message) {
            const content = getTextContent(message);
            const from = message.from; 
            
            // 1. Identifica Contato (Com busca aprimorada)
            const possibleNumbers = normalizeAndGeneratePhoneNumbers(from);
            
            let { data: contactPhone } = await supabaseAdmin
                .from('telefones')
                .select('contato_id')
                .in('telefone', possibleNumbers)
                .limit(1)
                .maybeSingle();

            let contatoId = contactPhone?.contato_id;
            let contatoNome = `Lead (${from})`;
            let isNewLead = false;

            if (!contatoId) {
                isNewLead = true;
                const { data: newContact } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, tipo_contato: 'Lead', organizacao_id: config.organizacao_id,
                    is_awaiting_name_response: false
                }).select().single();
                
                contatoId = newContact.id;
                
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, telefone: from, tipo: 'celular', organizacao_id: config.organizacao_id
                });

                // Funil e Automação (Lógica simplificada para brevidade)
                const { data: funil } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', config.organizacao_id).limit(1).single();
                if (funil) {
                    const { data: col } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem').limit(1).single();
                    if (col) {
                        await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: col.id, organizacao_id: config.organizacao_id });
                        const { data: autos } = await supabaseAdmin.from('automacoes').select('*').match({ organizacao_id: config.organizacao_id, ativo: true, gatilho_tipo: 'CRIAR_CARD' }).contains('gatilho_config', { coluna_id: col.id });
                        if (autos?.length) {
                            for (const auto of autos) {
                                if (auto.acao_tipo === 'ENVIAR_WHATSAPP') await sendTemplateMessage(supabaseAdmin, config, from, newContact, auto.acao_config.template_nome, auto.acao_config.template_idioma);
                            }
                        }
                    }
                }
            } else {
                const { data: existing } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                if (existing) {
                    contatoNome = existing.nome;
                    if (existing.is_awaiting_name_response && content && content.length > 2) {
                        await supabaseAdmin.from('contatos').update({ nome: content, is_awaiting_name_response: false }).eq('id', contatoId);
                        contatoNome = content;
                    }
                }
            }

            // 2. Salva Mensagem
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId, message_id: message.id, sender_id: from,
                receiver_id: config.whatsapp_phone_number_id, content: content,
                sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                direction: 'inbound', status: 'delivered', raw_payload: message,
                organizacao_id: config.organizacao_id
            });
            
            // 3. --- LÓGICA DE UNIFICAÇÃO DE CONVERSA ---
            // Objetivo: Se já existe uma conversa para este CONTATO (com qualquer número), usamos ela.
            // Isso evita criar uma linha nova na lista só porque o WhatsApp mandou o número com '55'
            
            let conversationKey = from; // Padrão: usa o número que chegou

            // Busca todos os telefones deste contato
            const { data: allContactPhones } = await supabaseAdmin
                .from('telefones')
                .select('telefone')
                .eq('contato_id', contatoId);

            if (allContactPhones && allContactPhones.length > 0) {
                const phoneList = allContactPhones.map(p => p.telefone);
                
                // Verifica se ALGUM desses telefones já tem uma conversa iniciada
                const { data: existingConv } = await supabaseAdmin
                    .from('whatsapp_conversations')
                    .select('phone_number')
                    .in('phone_number', phoneList)
                    .limit(1)
                    .maybeSingle();

                if (existingConv) {
                    // ACHOU! Vamos reusar o número "antigo" como chave da conversa
                    // Isso fará a mensagem aparecer na conversa antiga na sua lista
                    conversationKey = existingConv.phone_number;
                }
            }

            // Atualiza a conversa (usando a chave inteligente)
            await supabaseAdmin.from('whatsapp_conversations').upsert({ 
                phone_number: conversationKey, 
                updated_at: new Date().toISOString() 
            }, { onConflict: 'phone_number' });

            // 4. Notificação
            if (content) {
                let notifTitle = isNewLead ? '🎉 Novo Lead no WhatsApp!' : `💬 Mensagem de ${contatoNome}`;
                let notifBody = isNewLead 
                    ? `Novo contato (${from}): "${content.substring(0, 50)}..."` 
                    : content.substring(0, 100) + (content.length > 100 ? '...' : '');

                await dispatchNotification(supabaseAdmin, config.organizacao_id, notifTitle, notifBody, '/crm');
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}