import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO CARTEIRO (NOTIFICAÇÃO) ---
async function notifyOrg(organizacao_id, title, message) {
    // 1. Define a URL base (Prioriza a variável que criamos, depois tenta outras)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://studio57.arq.br';
    const apiUrl = `${baseUrl}/api/notifications/send`;

    try {
        // Dispara o alerta para a API (sem travar o WhatsApp esperando resposta)
        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                organizacaoId: organizacao_id, // Garante que o ID da empresa vá certo
                title: title,
                message: message,
                url: '/crm' // Clicou, vai pro CRM
            }),
        }).catch(err => console.error('[Webhook Notification] Erro no envio:', err));

    } catch (error) {
        console.error('[Webhook Notification] Erro geral:', error);
    }
}

// --- INICIALIZAÇÃO DO SUPABASE (ADMIN) ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- FUNÇÕES DE ENVIO (MANTIDAS ORIGINAIS) ---
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

// --- FUNÇÕES AUXILIARES ---
function getTextContent(message) {
    if (!message || !message.type) return null;
    if (message.type === 'text') return message.text?.body;
    if (message.type === 'interactive') return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
    return null;
}

function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    const sets = new Set([digits]);
    // Lógica simples para lidar com o 9º dígito do Brasil
    if (digits.startsWith('55') && digits.length >= 12) {
        if (digits.length === 13) sets.add(digits.slice(0, 4) + digits.slice(5)); // Remove 9
        if (digits.length === 12) sets.add(digits.slice(0, 4) + '9' + digits.slice(4)); // Adiciona 9
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

            if (!contatoId) {
                // Cria novo contato
                const { data: newContact } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, tipo_contato: 'Lead', organizacao_id: config.organizacao_id,
                    is_awaiting_name_response: false
                }).select().single();
                
                contatoId = newContact.id;
                
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, telefone: from, tipo: 'celular', organizacao_id: config.organizacao_id
                });

                // Adiciona ao Funil e Verifica Automação (Resumido)
                const { data: funil } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', config.organizacao_id).limit(1).single();
                if (funil) {
                    const { data: col } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem').limit(1).single();
                    if (col) {
                        await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: col.id, organizacao_id: config.organizacao_id });
                        // Verifica automação de boas-vindas
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

            // 6. --- O GRANDE MOMENTO: NOTIFICAÇÃO PUSH ---
            if (content) {
                // Aqui chamamos o nosso carteiro atualizado
                await notifyOrg(config.organizacao_id, `Nova mensagem de ${contatoNome}`, content);
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}