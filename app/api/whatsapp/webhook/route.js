import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

// --- 1. CONFIGURAÇÃO DO WEB PUSH ---
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

// --- 3. NOTIFICAÇÃO ---
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
            
            // ---------------------------------------------------------
            // 1. Identifica Contato (USANDO A INTELIGÊNCIA DO BANCO)
            // ---------------------------------------------------------
            // Em vez de adivinhar no JS, perguntamos ao Banco: "Quem é o dono deste número?"
            // A função RPC 'find_contact_by_phone' lida com os 55, 9º dígito e formatações.
            
            const { data: foundId, error: searchError } = await supabaseAdmin
                .rpc('find_contact_by_phone', { phone_input: from });

            let contatoId = foundId; // Se achou, usa o ID. Se não, vem null.
            let contatoNome = `Lead (${from})`;
            let isNewLead = false;

            if (!contatoId) {
                // NÃO ACHOU NINGUÉM MESMO APÓS A BUSCA INTELIGENTE
                // SÓ AQUI CRIAMOS O LEAD
                console.log(`[Webhook] Contato não encontrado para ${from}. Criando novo Lead.`);
                
                isNewLead = true;
                const { data: newContact } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, tipo_contato: 'Lead', organizacao_id: config.organizacao_id,
                    is_awaiting_name_response: false
                }).select().single();
                
                contatoId = newContact.id;
                
                // Salva o telefone exatamente como veio
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, telefone: from, tipo: 'celular', organizacao_id: config.organizacao_id
                });

                // Funil e Automação
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
                // ACHOU O CONTATO! (Ex: Ana)
                // Vamos usar o ID existente e não criar nada novo.
                const { data: existing } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                if (existing) {
                    contatoNome = existing.nome;
                    if (existing.is_awaiting_name_response && content && content.length > 2) {
                        await supabaseAdmin.from('contatos').update({ nome: content, is_awaiting_name_response: false }).eq('id', contatoId);
                        contatoNome = content;
                    }
                }
                console.log(`[Webhook] Contato identificado: ${contatoNome} (ID: ${contatoId})`);
            }

            // ---------------------------------------------------------
            // 2. ATUALIZA/CRIA A CONVERSA
            // ---------------------------------------------------------
            // O Trigger do banco 'tr_auto_assign_contact' vai garantir que o contato_id esteja correto
            await supabaseAdmin.from('whatsapp_conversations').upsert({ 
                phone_number: from, 
                updated_at: new Date().toISOString() 
            }, { onConflict: 'phone_number' });

            // ---------------------------------------------------------
            // 3. SALVA A MENSAGEM
            // ---------------------------------------------------------
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId, // Vincula ao ID correto (Ana)
                message_id: message.id, 
                sender_id: from,
                receiver_id: config.whatsapp_phone_number_id, 
                content: content,
                sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                direction: 'inbound', 
                status: 'delivered', 
                raw_payload: message,
                organizacao_id: config.organizacao_id
            });
            
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