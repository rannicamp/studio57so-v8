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
        // A. Busca usuários da organização
        const { data: users } = await supabaseAdmin
            .from('usuarios')
            .select('id, preferencias_notificacao')
            .eq('organizacao_id', organizacaoId);

        if (!users || users.length === 0) return;

        const notificationsToInsert = [];
        const pushPromises = [];

        // B. Filtra quem deve receber (Canal 'comercial')
        for (const user of users) {
            const prefs = user.preferencias_notificacao;
            // Se o usuário DESLIGOU o canal comercial, ignora ele
            if (prefs && prefs.comercial === false) continue;

            // Prepara para o Sininho
            notificationsToInsert.push({
                user_id: user.id,
                titulo: title,
                mensagem: message,
                link: url,
                lida: false,
                organizacao_id: organizacaoId,
                created_at: new Date().toISOString()
            });

            // Prepara o Push (Celular)
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
                            message: message, // Fallback
                            url: url,
                            icon: '/icons/icon-192x192.png',
                            tag: 'whatsapp-msg' // Agrupa notificações para não spammar
                        });

                        return Promise.all(subs.map(sub => 
                            webPush.sendNotification(sub.subscription_data, payload)
                                .catch(err => {
                                    // Remove inscrições mortas
                                    if (err.statusCode === 410 || err.statusCode === 404) {
                                        supabaseAdmin.from('notification_subscriptions').delete().eq('id', sub.id).then();
                                    }
                                })
                        ));
                    });
                pushPromises.push(p);
            }
        }

        // C. Executa tudo
        if (notificationsToInsert.length > 0) {
            await supabaseAdmin.from('notificacoes').insert(notificationsToInsert);
        }
        await Promise.allSettled(pushPromises);
        console.log(`[WhatsApp] Notificação enviada para ${notificationsToInsert.length} usuários.`);

    } catch (error) {
        console.error('[WhatsApp Notification Error]', error);
    }
}

// --- FUNÇÕES DE ENVIO (MANTIDAS) ---
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

function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    const sets = new Set([digits]);
    if (digits.startsWith('55') && digits.length >= 12) {
        if (digits.length === 13) sets.add(digits.slice(0, 4) + digits.slice(5)); 
        if (digits.length === 12) sets.add(digits.slice(0, 4) + '9' + digits.slice(4)); 
    }
    return Array.from(sets);
}

// --- ROTA DE VERIFICAÇÃO (GET) ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('hub.mode') === 'subscribe' && 
        searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

// --- ROTA PRINCIPAL (POST) ---
export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        
        // 1. Busca Configuração
        const { data: config } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*, organizacao_id')
            .single();

        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 500 });

        // 2. Verifica se é Status (ignora) ou Mensagem
        const change = body.entry?.[0]?.changes?.[0]?.value;
        if (change?.statuses) return NextResponse.json({ status: 'ok' });

        const message = change?.messages?.[0];
        if (message) {
            const content = getTextContent(message);
            const from = message.from;
            
            // 3. Identifica ou Cria Contato
            const phones = normalizeAndGeneratePhoneNumbers(from);
            let { data: contactPhone } = await supabaseAdmin
                .from('telefones')
                .select('contato_id')
                .in('telefone', phones)
                .maybeSingle();

            let contatoId = contactPhone?.contato_id;
            let contatoNome = `Lead (${from})`;
            let isNewLead = false; // Flag para saber se é novo

            if (!contatoId) {
                // Cria novo contato
                isNewLead = true;
                const { data: newContact } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, tipo_contato: 'Lead', organizacao_id: config.organizacao_id,
                    is_awaiting_name_response: false
                }).select().single();
                
                contatoId = newContact.id;
                
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, telefone: from, tipo: 'celular', organizacao_id: config.organizacao_id
                });

                // Adiciona ao Funil e Verifica Automação
                const { data: funil } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', config.organizacao_id).limit(1).single();
                if (funil) {
                    const { data: col } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem').limit(1).single();
                    if (col) {
                        await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: col.id, organizacao_id: config.organizacao_id });
                        // Verifica automação de boas-vindas...
                        const { data: autos } = await supabaseAdmin.from('automacoes').select('*')
                            .match({ organizacao_id: config.organizacao_id, ativo: true, gatilho_tipo: 'CRIAR_CARD' })
                            .contains('gatilho_config', { coluna_id: col.id });
                            
                        if (autos?.length) {
                            for (const auto of autos) {
                                if (auto.acao_tipo === 'ENVIAR_WHATSAPP') {
                                    await sendTemplateMessage(supabaseAdmin, config, from, newContact, auto.acao_config.template_nome, auto.acao_config.template_idioma);
                                }
                            }
                        }
                    }
                }
            } else {
                // Atualiza nome se estiver esperando
                const { data: existing } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                if (existing) {
                    contatoNome = existing.nome;
                    if (existing.is_awaiting_name_response && content && content.length > 2) {
                        await supabaseAdmin.from('contatos').update({ nome: content, is_awaiting_name_response: false }).eq('id', contatoId);
                        contatoNome = content;
                    }
                }
            }

            // 4. Salva Mensagem no Banco
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId, message_id: message.id, sender_id: from,
                receiver_id: config.whatsapp_phone_number_id, content: content,
                sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                direction: 'inbound', status: 'delivered', raw_payload: message,
                organizacao_id: config.organizacao_id
            });
            
            // 5. Atualiza Conversa
            await supabaseAdmin.from('whatsapp_conversations').upsert({ phone_number: from, updated_at: new Date().toISOString() }, { onConflict: 'phone_number' });

            // 6. --- O GRANDE MOMENTO: NOTIFICAÇÃO ---
            if (content) {
                let notifTitle = '';
                let notifBody = '';

                if (isNewLead) {
                    notifTitle = '🎉 Novo Lead no WhatsApp!';
                    notifBody = `Um novo contato (${from}) mandou mensagem: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;
                } else {
                    notifTitle = `💬 Mensagem de ${contatoNome}`;
                    notifBody = content.substring(0, 100) + (content.length > 100 ? '...' : '');
                }

                await dispatchNotification(
                    supabaseAdmin,
                    config.organizacao_id,
                    notifTitle,
                    notifBody,
                    '/crm' // Link para o CRM/Chat
                );
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}