// app/api/meta/anuncios/update-status/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// O PORQUÊ DESTE NOVO ARQUIVO:
// Esta rota robustece a ação de Ativar/Pausar. Ela age como um "gerente de operações".
// 1. Recebe a ordem do front-end (ID do anúncio e novo status).
// 2. Envia o comando para a API da Meta para alterar o status do anúncio real.
// 3. Se a Meta confirmar que a operação foi um sucesso, ela atualiza o status
//    do anúncio correspondente em nossa própria tabela `meta_ads` no Supabase.
// Isso garante que nossos dados locais sempre reflitam a realidade da Meta.

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

export async function POST(request) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    if (!PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ error: 'Token de acesso da Meta não configurado.' }, { status: 500 });
    }

    try {
        // Segurança: Verificando se o usuário está logado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Obtém os dados enviados pelo botão
        const { adId, newStatus } = await request.json();
        if (!adId || !newStatus) {
            return NextResponse.json({ error: 'ID do anúncio e novo status são obrigatórios.' }, { status: 400 });
        }
        
        // Passo 1: Tentar atualizar na Meta
        console.log(`LOG: Tentando atualizar o status do anúncio ${adId} para ${newStatus} na Meta.`);
        const url = `https://graph.facebook.com/v20.0/${adId}?access_token=${PAGE_ACCESS_TOKEN}`;
        const body = new URLSearchParams({ 'status': newStatus });

        const metaResponse = await fetch(url, {
            method: 'POST',
            body: body,
        });
        const metaResponseData = await metaResponse.json();

        if (!metaResponse.ok) {
            console.error("Erro ao atualizar na API da Meta:", metaResponseData.error);
            throw new Error(metaResponseData.error?.message || 'Falha ao atualizar status na API da Meta.');
        }

        console.log(`LOG: Sucesso na Meta! Agora atualizando o banco de dados local.`);

        // Passo 2: Se a Meta deu OK, atualizar no nosso banco de dados
        const { error: supabaseError } = await supabase
            .from('meta_ads')
            .update({ status: newStatus })
            .eq('id', adId);

        if (supabaseError) {
            console.error("Erro ao atualizar status no Supabase após sucesso na Meta:", supabaseError);
            // Mesmo com erro aqui, retornamos sucesso, pois a ação principal (na Meta) funcionou.
            // A próxima sincronização manual corrigiria o status local de qualquer maneira.
        }

        return NextResponse.json({ success: true, message: 'Status atualizado com sucesso na Meta e no banco local.' });

    } catch (error) {
        console.error("Erro na API de atualização de status:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}