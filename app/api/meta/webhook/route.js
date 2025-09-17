import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        console.error("LOG: ERRO CRÍTICO - Variáveis de ambiente do Supabase não encontradas!");
        return null;
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
};

// Função "Detetive": Descobre a organização_id a partir do page_id
async function getOrganizationIdByPageId(supabase, pageId) {
    console.log(`LOG: [DETETIVE] Iniciando investigação para a página ID: ${pageId}`);
    
    // 1. Pergunta à API da Meta quem é o "dono" da página
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    if (!PAGE_ACCESS_TOKEN) {
        throw new Error("Token de Acesso à Página (META_PAGE_ACCESS_TOKEN) não configurado no servidor.");
    }

    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=business&access_token=${PAGE_ACCESS_TOKEN}`;
    console.log(`LOG: [DETETIVE] Consultando a Meta: ${url.replace(PAGE_ACCESS_TOKEN, '******')}`);
    
    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
        throw new Error(`[DETETIVE] Falha ao buscar dados da página na Meta: ${metaData.error?.message || 'Erro desconhecido'}`);
    }

    const metaBusinessId = metaData.business?.id;
    if (!metaBusinessId) {
        throw new Error(`[DETETIVE] A página com ID ${pageId} não está associada a um Gerenciador de Negócios (Meta Business Manager).`);
    }
    console.log(`LOG: [DETETIVE] Dono encontrado! Meta Business ID: ${metaBusinessId}`);

    // 2. Resolve o caso consultando nosso banco de dados
    const { data: empresa, error } = await supabase
        .from('cadastro_empresa')
        .select('organizacao_id')
        .eq('meta_business_id', metaBusinessId)
        .single();

    if (error) {
        throw new Error(`[DETETIVE] Erro ao consultar a empresa no banco de dados com o Meta Business ID: ${metaBusinessId}. Detalhes: ${error.message}`);
    }
    if (!empresa) {
        throw new Error(`[DETETIVE] Nenhuma empresa encontrada no sistema com o Meta Business ID: ${metaBusinessId}. Cadastre a empresa e seu ID para receber os leads.`);
    }

    console.log(`LOG: [DETETIVE] Caso resolvido! Organização ID: ${empresa.organizacao_id}`);
    return empresa.organizacao_id;
}


// Função para garantir que o funil e a primeira coluna existam para uma organização.
async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    console.log(`LOG: Verificando funil e coluna para a organização ID: ${organizacaoId}`);

    // 1. Tenta encontrar o funil de vendas padrão para a organização.
    let { data: funil, error: funilFindError } = await supabase
        .from('funis')
        .select('id')
        .eq('nome', 'Funil de Vendas')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (funilFindError && funilFindError.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar funil: ${funilFindError.message}`);
    }

    // 2. Se o funil não existir, cria um novo para a organização.
    if (!funil) {
        console.log(`LOG: Funil de Vendas não encontrado para org ${organizacaoId}. Criando um novo...`);
        const { data: newFunil, error: funilCreateError } = await supabase
            .from('funis')
            .insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId })
            .select('id')
            .single();
        if (funilCreateError) throw new Error(`Erro ao criar funil: ${funilCreateError.message}`);
        funil = newFunil;
        console.log(`LOG: Funil criado com ID: ${funil.id} para org ${organizacaoId}`);
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
            .insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId })
            .select('id')
            .single();
        if (colunaCreateError) throw new Error(`Erro ao criar coluna: ${colunaCreateError.message}`);
        primeiraColuna = newColuna;
        console.log(`LOG: Coluna criada com ID: ${primeiraColuna.id}`);
    }

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
        const pageId = leadValue.page_id;

        if (!leadId || !pageId) {
             console.error("LOG: ERRO CRÍTICO - O evento de Lead não continha 'leadgen_id' ou 'page_id'.");
             throw new Error("O evento de Lead recebido não continha a identificação do lead (leadgen_id) ou da página (page_id).");
        }

        console.log(`LOG: Buscando no DB por contato com meta_lead_id: ${leadId}`);
        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();

        if (existingLead) {
            console.log(`LOG: Lead com ID ${leadId} já existe no DB. Nenhuma ação necessária.`);
            return NextResponse.json({ status: 'lead_already_exists' }, { status: 200 });
        }
        
        let leadDetails;
        let organizacaoId;

        // Verifica se é um lead de teste para não chamar a API da Meta
        if (leadId.startsWith('TEST_')) {
            console.log("LOG: [TESTE] Lead de simulação detectado. Usando dados fictícios.");
            leadDetails = {
                field_data: [
                    { name: "full_name", values: ["João da Silva (Teste)"] },
                    { name: "email", values: [`teste_${Date.now()}@studio57.com.br`] },
                    { name: "phone_number", values: ["+5533999998888"] },
                ]
            };
            // Para testes, vamos buscar a primeira organização disponível.
            const { data: firstOrg, error: orgError } = await supabase.from('organizacoes').select('id').limit(1).single();
            if (orgError || !firstOrg) {
                throw new Error("Não foi possível encontrar uma organização para o lead de teste.");
            }
            organizacaoId = firstOrg.id;
            console.log(`LOG: [TESTE] Usando organização de fallback com ID: ${organizacaoId}`);

        } else {
            console.log(`LOG: Lead real ID ${leadId}. Buscando detalhes na API da Meta...`);
            const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadId}?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`);
            const apiResult = await leadDetailsResponse.json();
            if (!leadDetailsResponse.ok) throw new Error(apiResult.error?.message || "Falha ao buscar dados do lead no Meta.");
            leadDetails = apiResult;

            // A MÁGICA ACONTECE AQUI: nosso detetive entra em ação
            organizacaoId = await getOrganizationIdByPageId(supabase, pageId);
        }

        console.log("LOG: Detalhes do lead recebidos com sucesso.");
        
        const allLeadData = {};
        leadDetails.field_data.forEach(field => {
            allLeadData[field.name] = field.values[0];
        });
        
        const nomeCompleto = allLeadData.full_name || `Lead Meta (${new Date().toLocaleDateString()})`;
        const email = allLeadData.email;
        const telefoneLimpo = allLeadData.phone_number?.replace(/\D/g, '');

        console.log(`LOG: Criando novo contato na organização ${organizacaoId}...`);
        const { data: newContact, error: contactError } = await supabase
            .from('contatos')
            .insert({
                nome: nomeCompleto,
                origem: 'Meta Lead Ad',
                tipo_contato: 'Lead',
                personalidade_juridica: 'Pessoa Física',
                organizacao_id: organizacaoId, // <<<<<<< IMPORTANTE: Salvando com a organização correta
                meta_lead_id: leadId,
                meta_ad_id: leadValue.ad_id,
                meta_adgroup_id: leadValue.adgroup_id,
                meta_form_id: leadValue.form_id,
                meta_page_id: leadValue.page_id,
                meta_created_time: new Date(leadValue.created_time * 1000).toISOString(),
                meta_form_data: allLeadData 
            })
            .select('id')
            .single();

        if (contactError) {
             console.error("LOG: ERRO ao criar novo contato no DB:", contactError);
             throw new Error(`Erro ao criar novo contato no DB: ${contactError.message}`);
        }
            
        const contatoId = newContact.id;
        console.log(`LOG: Novo contato criado com ID: ${contatoId} para o Lead ID: ${leadId}`);

        if (email) await supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal', organizacao_id: organizacaoId });
        if (telefoneLimpo) await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefoneLimpo, tipo: 'Celular', organizacao_id: organizacaoId });
        console.log("LOG: Email e telefone associados ao novo contato.");
        
        console.log(`LOG: Garantindo a existência do funil e da coluna para adicionar o contato ${contatoId}...`);
        const primeiraColunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        
        const { error: funilError } = await supabase
            .from('contatos_no_funil')
            .insert({ contato_id: contatoId, coluna_id: primeiraColunaId, organizacao_id: organizacaoId });
            
        if (funilError) {
            console.error('LOG: ERRO ao adicionar contato ao funil:', funilError);
        } else {
            console.log('LOG: SUCESSO! Contato adicionado ao funil! Disparando notificação...');
            
            // Dispara a notificação
            fetch(`${request.nextUrl.origin}/api/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '🎉 Novo Lead Recebido!',
                    message: `Um novo lead (${nomeCompleto}) chegou através da campanha da Meta.`,
                    url: '/crm',
                    organizacao_id: organizacaoId // Enviando a organização para notificar os usuários certos
                })
            }).catch(err => console.error("Falha ao disparar notificação de novo lead:", err));
        }

        console.log("LOG: [FIM] Processamento do webhook concluído com sucesso.");
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO GERAL] Ocorreu um erro no processamento do webhook:', e);
        // Usamos status 200 para que a Meta não desabilite o webhook por falhas.
        // O erro já está logado no nosso sistema para análise.
        return NextResponse.json({ status: 'error', message: e.message }, { status: 200 }); 
    }
}