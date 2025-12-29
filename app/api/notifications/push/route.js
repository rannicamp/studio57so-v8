// app/api/notifications/push/route.js
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';
import { NextResponse } from 'next/server';

// Configura as chaves do Web Push (Carteiro)
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
        'mailto:suporte@studio57.arq.br',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function POST(request) {
    try {
        const body = await request.json();
        
        // O Supabase envia os dados no formato { type: 'INSERT', record: { ... } }
        const { type, table, record } = body;

        // Validação de Segurança Básica: Só processa INSERTs na tabela notificacoes que exigem push
        if (type !== 'INSERT' || table !== 'notificacoes' || !record.enviar_push) {
            return NextResponse.json({ message: 'Ignorado: Não requer push' });
        }

        console.log(`[Push API] Processando envio para User ID: ${record.user_id}`);

        // Cria cliente Admin para buscar as inscrições (celulares cadastrados)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Busca todos os dispositivos inscritos desse usuário
        const { data: subs, error } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', record.user_id);

        if (error || !subs || subs.length === 0) {
            console.log('[Push API] Nenhum dispositivo encontrado para este usuário.');
            return NextResponse.json({ message: 'Sem dispositivos' });
        }

        // Monta o pacote da notificação
        const payload = JSON.stringify({
            title: record.titulo,
            body: record.mensagem,
            url: record.link,
            icon: '/icons/icon-192x192.png',
            tag: record.tipo // 'whatsapp' ou 'sistema' - isso define o ícone no celular
        });

        // Dispara para todos os dispositivos em paralelo
        const promises = subs.map(sub => 
            webPush.sendNotification(sub.subscription_data, payload)
                .then(() => ({ success: true, id: sub.id }))
                .catch(err => {
                    console.error(`[Push API] Falha no envio (ID ${sub.id}):`, err.statusCode);
                    // Se der erro 410 (Gone) ou 404, o dispositivo não existe mais -> Removemos do banco
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        return supabase.from('notification_subscriptions').delete().eq('id', sub.id)
                            .then(() => ({ success: false, id: sub.id, action: 'deleted' }));
                    }
                    return ({ success: false, error: err });
                })
        );

        await Promise.allSettled(promises);
        
        return NextResponse.json({ success: true, devices: subs.length });

    } catch (error) {
        console.error('[Push API] Erro Crítico:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}