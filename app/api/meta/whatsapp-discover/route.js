import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { FacebookAdsApi } from 'facebook-nodejs-business-sdk';

export async function GET(request) {
    try {
        console.log('🟢 [WhatsApp Discover] Iniciando varredura mágica...');
        const supabase = await createClient();

        // 1. Quem é o usuário e a qual org ele pertence?
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: userData } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        if (!userData?.organizacao_id) return NextResponse.json({ error: 'Org não encontrada' }, { status: 400 });

        // 2. Traz a integração VIP do Meta (Precisamos do Token de longa duração)
        const { data: integracao } = await supabase
            .from('integracoes_meta')
            .select('access_token')
            .eq('organizacao_id', userData.organizacao_id)
            .single();

        if (!integracao?.access_token) {
            return NextResponse.json({ error: 'Conecte-se ao Facebook primeiro.' }, { status: 404 });
        }

        const accessToken = integracao.access_token;

        // =========================================================================================
        // O PROCESSO INVESTIGATIVO (GRAPH API DIRETA PARA PULAR LIMITES DO SDK)
        // =========================================================================================

        // Passo A: Descobrir quais Business Managers (BM) esse cara tem acesso
        const bmUrl = `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}&fields=id,name`;
        const bmRes = await fetch(bmUrl);
        const bmData = await bmRes.json();

        if (bmData.error) throw new Error(`Erro BM: ${bmData.error.message}`);

        const businesses = bmData.data || [];
        if (businesses.length === 0) {
            return NextResponse.json({ data: [] }); // O cara não tem um BM, então não tem WhatsApp Oficial.
        }

        const discoveredNumbers = [];

        // Passo B: Vasculhar CADA Business Manager atrás da mina de ouro: As WABAs
        for (const bm of businesses) {
            console.log(`🔎 [WhatsApp Discover] Vasculhando o BM: ${bm.name} (${bm.id})`);

            // Procura as contas do WhatsApp Business (WABA)
            const wabaUrl = `https://graph.facebook.com/v20.0/${bm.id}/owned_whatsapp_business_accounts?access_token=${accessToken}&fields=id,name`;
            const wabaRes = await fetch(wabaUrl);
            const wabaData = await wabaRes.json();

            if (wabaData.error) {
                console.warn(`[WhatsApp Discover] BM ${bm.name} recusou acesso ao WABA: ${wabaData.error.message}`);
                continue; // Pula para o próximo BM
            }

            const wabas = wabaData.data || [];

            // Passo C: Dentro de cada WABA, procurar os Números de Telefone 📞
            for (const waba of wabas) {
                const phoneUrl = `https://graph.facebook.com/v20.0/${waba.id}/phone_numbers?access_token=${accessToken}&fields=id,display_phone_number,verified_name,quality_rating`;
                const phoneRes = await fetch(phoneUrl);
                const phoneData = await phoneRes.json();

                if (!phoneData.error && phoneData.data) {
                    phoneData.data.forEach(phone => {
                        discoveredNumbers.push({
                            waba_id: waba.id,                // Precisa pro Webhook
                            waba_name: waba.name,
                            phone_number_id: phone.id,       // A chave mestra de envio de msg
                            display_phone: phone.display_phone_number,
                            verified_name: phone.verified_name || "Número não verificado",
                            business_manager: bm.name,
                            quality: phone.quality_rating
                        });
                    });
                }
            }
        }

        console.log(`✅ [WhatsApp Discover] Encontrados ${discoveredNumbers.length} números.`);
        return NextResponse.json({ data: discoveredNumbers });

    } catch (error) {
        console.error('💥 [WhatsApp Discover] Falha Crítica:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Salva o WABA ID e PHONE NUMBER ID no banco!
export async function POST(request) {
    console.log('🔵 [WhatsApp Discover] Pedido de Salvamento...');
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const body = await request.json();
        const { waba_id, phone_number_id, whatsapp_token } = body;

        const { data: userData } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        if (!userData?.organizacao_id) {
            return NextResponse.json({ error: 'Org não encontrada' }, { status: 400 });
        }

        // 🏆 HIERARQUIA DE TOKEN (DO MAIS CONFIÁVEL AO MENOS CONFIÁVEL):
        // 1º WHATSAPP_SYSTEM_USER_TOKEN (env var) → Token permanente de System User, nunca expira
        // 2º whatsapp_token (vindo na requisição) → Token específico passado manualmente
        // 3º integracao.access_token (OAuth do banco) → Token de 60 dias, pode expirar!
        const systemUserToken = process.env.WHATSAPP_SYSTEM_USER_TOKEN;

        const { data: integracao } = await supabase
            .from('integracoes_meta')
            .select('access_token')
            .eq('organizacao_id', userData.organizacao_id)
            .single();

        const wToken = systemUserToken || whatsapp_token || integracao?.access_token;

        if (systemUserToken) {
            console.log('🏆 [WhatsApp Discover] Usando token permanente do System User (não expira).');
        } else {
            console.warn('⚠️ [WhatsApp Discover] ATENÇÃO: Usando token OAuth de 60 dias! Configure WHATSAPP_SYSTEM_USER_TOKEN no Netlify.');
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        console.log('✅ Token selecionado. Preenchendo configuração de WhatsApp...');

        // ====================================================================
        // A MÁGICA FINAL: Injetar também na Tabela de Inbox do CRM (WhatsApp)
        // ====================================================================

        // Verifica se já existe configuração de WhatsApp para essa org
        const { data: configAtual } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('id')
            .eq('organizacao_id', userData.organizacao_id)
            .single();

        // Busca uma Empresa válida da Organização para preencher o campo obrigatório
        const { data: empresaPadrao } = await supabaseAdmin
            .from('cadastro_empresa')
            .select('id')
            .eq('organizacao_id', userData.organizacao_id)
            .limit(1)
            .single();

        const payloadWhatsApp = {
            whatsapp_business_account_id: waba_id,
            whatsapp_phone_number_id: phone_number_id,
            whatsapp_permanent_token: wToken, // Usa o token mais confiável disponível
            verify_token: process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || 'Srbr19010720@',
            organizacao_id: userData.organizacao_id,
            empresa_id: empresaPadrao?.id
        };

        let errorWs;
        if (configAtual?.id) {
            // Atualiza
            const { error: eUpdate } = await supabaseAdmin
                .from('configuracoes_whatsapp')
                .update(payloadWhatsApp)
                .eq('id', configAtual.id);
            errorWs = eUpdate;
        } else {
            // Cria nova
            const { error: eInsert } = await supabaseAdmin
                .from('configuracoes_whatsapp')
                .insert([payloadWhatsApp]);
            errorWs = eInsert;
        }

        if (errorWs) {
            console.error('🚨 [WhatsApp Discover] Erro Banco (WS CRM):', errorWs);
            throw new Error(errorWs.message);
        }

        console.log('✅ [WhatsApp Discover] O WhatsApp Mágico foi plugado!');
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('💥 [WhatsApp Discover] Erro Fatal no POST:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
