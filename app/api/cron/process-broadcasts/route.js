import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processBroadcast } from '@/utils/broadcastProcessor';

export const dynamic = 'force-dynamic'; // Garante que não faça cache

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar Agendamentos Pendentes e Vencidos
    const now = new Date().toISOString();
    const { data: jobs } = await supabaseAdmin
        .from('whatsapp_scheduled_broadcasts')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now) // Data menor ou igual a agora
        .limit(5); // Processa 5 listas por vez para não estourar tempo

    if (!jobs || jobs.length === 0) {
        return NextResponse.json({ message: 'Nada para processar.' });
    }

    const results = [];

    // 2. Processar cada Job
    for (const job of jobs) {
        // Marca como processando
        await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ status: 'processing' }).eq('id', job.id);

        // Busca Config e Membros
        const { data: config } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').eq('organizacao_id', job.organizacao_id).single();
        
        const { data: members } = await supabaseAdmin
            .from('whatsapp_list_members')
            .select('contatos(id, nome, telefones(telefone))')
            .eq('lista_id', job.lista_id);

        const validTargets = members?.map(m => ({
            id: m.contatos?.id, nome: m.contatos?.nome, telefone: m.contatos?.telefones?.[0]?.telefone
        })).filter(t => t.telefone) || [];

        // Dispara (Usando o Util)
        const stats = await processBroadcast(supabaseAdmin, config, validTargets, {
            template_name: job.template_name,
            language: job.language,
            variables: job.variables,
            full_text_base: job.full_text_base,
            components: job.components
        });

        // Finaliza
        await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ status: 'completed' }).eq('id', job.id);
        results.push({ job: job.id, stats });
    }

    return NextResponse.json({ processed: results });
}