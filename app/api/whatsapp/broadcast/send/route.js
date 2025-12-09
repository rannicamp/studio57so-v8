import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processBroadcast } from '@/utils/broadcastProcessor'; // O Cérebro Compartilhado

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração incompleta." }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        // Recebe todos os dados, inclusive o agendamento
        const { list_id, template_name, language, variables, full_text_base, components, scheduled_at } = body;

        // 1. Validar Configuração
        const { data: config } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').single();
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
                    variables,      // Salva as variáveis para usar depois
                    full_text_base, // Salva o texto base
                    components,     // Salva a imagem/video
                    scheduled_at,   // A DATA IMPORTANTE
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
        // 🚀 MODO ENVIO IMEDIATO (Usa o Processador)
        // =====================================================================

        // 2. Buscar Membros
        const { data: members, error: membersError } = await supabaseAdmin
            .from('whatsapp_list_members')
            .select('contatos(id, nome, telefones(telefone))')
            .eq('lista_id', list_id);

        if (membersError || !members || members.length === 0) {
            return NextResponse.json({ error: 'Lista vazia ou não encontrada.' }, { status: 400 });
        }

        const validTargets = members
            .map(m => ({
                id: m.contatos?.id,
                nome: m.contatos?.nome || '',
                telefone: m.contatos?.telefones?.[0]?.telefone
            }))
            .filter(t => t.telefone);

        console.log(`[Broadcast] Iniciando disparo imediato para ${validTargets.length} contatos.`);

        // 3. O CÉREBRO ENTRA EM AÇÃO AQUI
        // Ele faz o loop, o delay, a humanização do nome, tudo.
        const stats = await processBroadcast(supabaseAdmin, config, validTargets, {
            template_name, 
            language, 
            variables, 
            full_text_base, 
            components
        });

        return NextResponse.json({ 
            message: 'Disparo finalizado.', 
            stats 
        });

    } catch (error) {
        console.error('[Broadcast API Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}