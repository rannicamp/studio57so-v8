import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Função de Pausa (Delay) para evitar bloqueio
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração incompleta." }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        // Recebe os novos campos: components (mídia) e scheduled_at (data)
        const { list_id, template_name, language, variables, full_text_base, components, scheduled_at } = body;

        // 1. Validar e Buscar Configuração
        const { data: config } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*')
            .single();

        if (!config) return NextResponse.json({ error: 'Configuração do WhatsApp não encontrada.' }, { status: 500 });

        // =====================================================================
        // 🚦 DECISÃO: AGENDAR OU ENVIAR AGORA?
        // =====================================================================
        if (scheduled_at) {
            console.log(`[Broadcast] Agendando disparo para: ${scheduled_at}`);
            
            const { error: scheduleError } = await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .insert({
                    lista_id: list_id,
                    template_name,
                    language,
                    variables, // Salva as variáveis preenchidas no modal
                    full_text_base,
                    components, // Salva a imagem/video se tiver
                    scheduled_at,
                    status: 'pending',
                    organizacao_id: config.organizacao_id
                });

            if (scheduleError) throw scheduleError;

            return NextResponse.json({ 
                message: 'Disparo agendado com sucesso!', 
                scheduled: true,
                date: scheduled_at 
            });
        }

        // =====================================================================
        // 🚀 MODO ENVIO IMEDIATO (Lógica Original + Melhorias)
        // =====================================================================

        // 2. Buscar Membros da Lista
        const { data: members, error: membersError } = await supabaseAdmin
            .from('whatsapp_list_members')
            .select(`
                contato_id,
                contatos (
                    id,
                    nome,
                    telefones (telefone)
                )
            `)
            .eq('lista_id', list_id);

        if (membersError || !members || members.length === 0) {
            return NextResponse.json({ error: 'Lista vazia ou não encontrada.' }, { status: 400 });
        }

        // Filtra apenas contatos com telefone válido
        const validTargets = members
            .map(m => ({
                id: m.contatos?.id,
                nome: m.contatos?.nome || '',
                telefone: m.contatos?.telefones?.[0]?.telefone
            }))
            .filter(t => t.telefone);

        console.log(`[Broadcast] Iniciando disparo para ${validTargets.length} contatos. Lista: ${list_id}`);

        // 3. Loop de Disparo (Processamento em Série para Segurança)
        let successCount = 0;
        let failCount = 0;
        
        const results = [];

        for (const target of validTargets) {
            try {
                // --- HUMANIZAÇÃO: Extrair Primeiro Nome ---
                const firstName = target.nome.split(' ')[0] || target.nome;
                
                // Substitui a variável {{1}} pelo Primeiro Nome
                // Clona as variáveis para não alterar o original que veio do request
                const personalizedVariables = [...(variables || [])];
                if (personalizedVariables.length > 0) {
                    // Assume que a primeira variável é sempre o nome na saudação
                    personalizedVariables[0] = firstName; 
                }

                // --- MONTAGEM DOS COMPONENTES (TEXTO + MÍDIA) ---
                const messageComponents = [];

                // 1. Adiciona Header (Imagem/Vídeo) se veio do frontend
                // O frontend manda 'components' contendo apenas o header se houver
                if (components && Array.isArray(components)) {
                     const headerComp = components.find(c => c.type === 'header');
                     if (headerComp) messageComponents.push(headerComp);
                }

                // 2. Adiciona Body com as variáveis personalizadas (Nome do Cliente)
                if (personalizedVariables.length > 0) {
                    messageComponents.push({
                        type: 'body',
                        parameters: personalizedVariables.map(v => ({ type: 'text', text: v }))
                    });
                }

                // Monta o Texto Completo para o Histórico (com o nome da pessoa)
                let personalizedText = full_text_base || '';
                personalizedVariables.forEach((val, i) => {
                    personalizedText = personalizedText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
                });

                // Preparar Payload Meta
                const payload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: target.telefone,
                    type: 'template',
                    template: {
                        name: template_name,
                        language: { code: language || 'pt_BR' },
                        components: messageComponents
                    }
                };

                // Envia para Meta
                const response = await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.whatsapp_permanent_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const resData = await response.json();

                if (!response.ok) {
                    console.error(`[Broadcast] Falha para ${target.nome}:`, resData);
                    failCount++;
                    results.push({ contact: target.nome, status: 'error', error: resData });
                } else {
                    successCount++;
                    results.push({ contact: target.nome, status: 'success' });

                    // Salva no Histórico do Contato (Chat Individual)
                    const newMessageId = resData.messages?.[0]?.id;
                    if (newMessageId) {
                        await supabaseAdmin.from('whatsapp_messages').insert({
                            contato_id: target.id,
                            message_id: newMessageId,
                            sender_id: config.whatsapp_phone_number_id,
                            receiver_id: target.telefone,
                            content: personalizedText,
                            sent_at: new Date().toISOString(),
                            direction: 'outbound',
                            status: 'sent',
                            raw_payload: JSON.stringify(payload),
                            organizacao_id: config.organizacao_id
                        });
                    }
                }

                // --- SEGURANÇA: Delay Aleatório entre 2s e 5s ---
                const delay = Math.floor(Math.random() * 3000) + 2000;
                await sleep(delay);

            } catch (innerError) {
                console.error(`[Broadcast] Erro interno para ${target.nome}:`, innerError);
                failCount++;
            }
        }

        return NextResponse.json({ 
            message: 'Disparo finalizado.', 
            stats: { total: validTargets.length, success: successCount, failed: failCount } 
        });

    } catch (error) {
        console.error('[Broadcast Fatal Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}