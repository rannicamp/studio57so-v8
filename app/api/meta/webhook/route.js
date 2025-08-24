// app/api/meta/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("LOG: ERRO CRÍTICO - Variáveis de ambiente do Supabase não encontradas!");
        return null;
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
};

// Função para garantir que o funil e a primeira coluna existam, criando-os se necessário.
async function ensureFunilAndFirstColumn(supabase) {
    // 1. Tenta encontrar o funil de vendas padrão.
    let { data: funil, error: funilFindError } = await supabase
        .from('funis')
        .select('id')
        .eq('nome', 'Funil de Vendas')
        .single();

    if (funilFindError && funilFindError.code !== 'PGRST116') { // PGRST116 = not found, o que é ok
        throw new Error(`Erro ao buscar funil: ${funilFindError.message}`);
    }

    // 2. Se o funil não existir, cria um novo.
    if (!funil) {
        console.log("LOG: Funil de Vendas não encontrado. Criando um novo...");
        const { data: newFunil, error: funilCreateError } = await supabase
            .from('funis')
            .insert({ nome: 'Funil de Vendas' })
            .select('id')
            .single();
        if (funilCreateError) throw new Error(`Erro ao criar funil: ${funilCreateError.message}`);
        funil = newFunil;
        console.log(`LOG: Funil criado com ID: ${funil.id}`);
    }

    // 3. Tenta encontrar a primeira coluna do funil.
    let { data: primeiraColuna, error: colunaFindError } = await supabase
        .from('colunas_funil')
        .select('id')
        .eq('funil_id', funil.id)
        .order('ordem', { ascending: true })
        .limit(1)
        .single();

    if (colunaFindError && colunaFindError.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar coluna: ${colunaFindError.message}`);
    }

    // 4. Se a coluna não existir, cria uma nova chamada "Novos Leads".
    if (!primeiraColuna) {
        console.log("LOG: Primeira coluna do funil não encontrada. Criando 'Novos Leads'...");
        const { data: newColuna, error: colunaCreateError } = await supabase
            .from('colunas_funil')
            .insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0 })
            .select('id')
            .single();
        if (colunaCreateError) throw new Error(`Erro ao criar coluna: ${colunaCreateError.message}`);
        primeiraColuna = newColuna;
        console.log(`LOG: Coluna criada com ID: ${primeiraColuna.id}`);
    }

    // 5. Retorna o ID da coluna que garantidamente existe.
    return primeiraColuna.id;
}


// Rota GET para verificação (sem alterações)
export async function GET(request) {
    console.log("LOG: Recebida requisição GET para verificação do webhook.");
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log("LOG: Verificação do webhook BEM-SUCEDIDA.");
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("LOG: FALHA na verificação do webhook. Token recebido:", token, "Token esperado:", META_VERIFY_TOKEN);
        return new NextResponse(null, { status: 403 });
    }
}

// Rota POST para receber os leads (lógica principal atualizada)
export async function POST(request) {
    console.log("LOG: [INÍCIO] Requisição POST recebida no webhook da Meta.");
    
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ status: 'error', message: 'Configuração do Supabase no servidor está incompleta.' }, { status: 500 });
    }
    
    try {
        const body = await request.json();
        console.log('LOG: Corpo da requisição completo:', JSON.stringify(body, null, 2));

        const change = body.entry?.[0]?.changes?.[0];

        if (change?.field !== 'leadgen') {
            console.log(`LOG: Ignorando evento, não é 'leadgen'. Campo recebido: ${change?.field}`);
            return NextResponse.json({ status: 'not_a_leadgen_event' }, { status: 200 });
        }
        
        const leadValue = change.value;
        const leadId = leadValue.leadgen_id;

        if (!leadId) {
             console.error("LOG: ERRO CRÍTICO - O evento de Lead não continha um 'leadgen_id'.");
             throw new Error("O evento de Lead recebido não continha a identificação do lead (leadgen_id).");
        }

        console.log(`LOG: Buscando no DB por contato com meta_lead_id: ${leadId}`);
        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();

        if (existingLead) {
            console.log(`LOG: Lead com ID ${leadId} já existe no DB. Nenhuma ação necessária.`);
            return NextResponse.json({ status: 'lead_already_exists' }, { status: 200 });
        }
        
        console.log(`LOG: Lead ID ${leadId} é novo. Buscando detalhes na API da Meta...`);
        const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

        if (!PAGE_ACCESS_TOKEN) {
            console.error("LOG: ERRO CRÍTICO - Variável de ambiente META_PAGE_ACCESS_TOKEN não encontrada.");
            throw new Error("Token de Acesso à Página não configurado no servidor.");
        }

        const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadId}?access_token=${PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadDetailsResponse.json();

        if (!leadDetailsResponse.ok) {
            console.error("LOG: ERRO na API da Meta:", leadDetails);
            throw new Error(leadDetails.error?.message || "Falha ao buscar dados do lead no Meta.");
        }

        console.log("LOG: Detalhes do lead recebidos com sucesso.");
        
        // ***** INÍCIO DA ALTERAÇÃO *****
        // Agora, guardamos todos os campos do formulário em um objeto
        const allLeadData = {};
        leadDetails.field_data.forEach(field => {
            allLeadData[field.name] = field.values[0];
        });
        
        const nomeCompleto = allLeadData.full_name || `Lead Meta (${new Date().toLocaleDateString()})`;
        const email = allLeadData.email;
        const telefoneLimpo = allLeadData.phone_number?.replace(/\D/g, '');

        console.log("LOG: Criando novo contato no DB com todos os metadados...");
        const { data: newContact, error: contactError } = await supabase
            .from('contatos')
            .insert({
                nome: nomeCompleto,
                origem: 'Meta Lead Ad',
                tipo_contato: 'Lead',
                personalidade_juridica: 'Pessoa Física',
                meta_lead_id: leadId,
                meta_ad_id: leadValue.ad_id,
                meta_adgroup_id: leadValue.adgroup_id,
                meta_form_id: leadValue.form_id,
                meta_page_id: leadValue.page_id,
                meta_created_time: new Date(leadValue.created_time * 1000).toISOString(),
                // Salvando o objeto completo com todos os campos na nova coluna
                meta_form_data: allLeadData 
            })
            // ***** FIM DA ALTERAÇÃO *****
            .select('id')
            .single();

        if (contactError) {
             console.error("LOG: ERRO ao criar novo contato no DB:", contactError);
             throw new Error(`Erro ao criar novo contato no DB: ${contactError.message}`);
        }
            
        const contatoId = newContact.id;
        console.log(`LOG: Novo contato criado com ID: ${contatoId} para o Lead ID: ${leadId}`);

        if (email) await supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal' });
        if (telefoneLimpo) await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefoneLimpo, tipo: 'Celular' });
        console.log("LOG: Email e telefone associados ao novo contato.");
        
        console.log(`LOG: Garantindo a existência do funil e da coluna para adicionar o contato ${contatoId}...`);
        const primeiraColunaId = await ensureFunilAndFirstColumn(supabase);
        
        const { error: funilError } = await supabase
            .from('contatos_no_funil')
            .insert({ contato_id: contatoId, coluna_id: primeiraColunaId });
            
        if (funilError) {
            console.error('LOG: ERRO ao adicionar contato ao funil:', funilError);
        } else {
            console.log('LOG: SUCESSO! Contato adicionado ao funil! Disparando notificação...');

            // --- INÍCIO DO CÓDIGO DE NOTIFICAÇÃO ---
            const notificationPayload = {
                title: '🎉 Novo Lead Recebido!',
                body: `Um novo lead (${nomeCompleto}) chegou através da campanha da Meta.`,
            };

            // Dispara a notificação para todos os usuários inscritos
            // Usamos 'fetch' para chamar nossa própria API de envio.
            // O 'request.nextUrl.origin' garante que o endereço esteja correto.
            await fetch(`${request.nextUrl.origin}/api/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationPayload),
            });
            // --- FIM DO CÓDIGO DE NOTIFICAÇÃO ---
        }

        console.log("LOG: [FIM] Processamento do webhook concluído com sucesso.");
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO GERAL] Ocorreu um erro no processamento do webhook:', e);
        return NextResponse.json({ status: 'error', message: e.message }, { status: 200 }); 
    }
}