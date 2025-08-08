// app/api/meta/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para criar um cliente Supabase com permissões de administrador (service_role)
// Isso é seguro para ser usado no backend (rotas de API)
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Rota GET: Verificação do Webhook (Handshake)
 * A Meta envia uma requisição GET para esta URL quando você a configura no painel do app.
 * Isso serve apenas para confirmar que a URL é válida e pertence a você.
 */
export async function GET(request) {
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Verifica se o modo é 'subscribe' e se o token de verificação bate com o que está no .env
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log("SUCESSO: Webhook verificado pela Meta.");
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("FALHA: A verificação do webhook falhou. Verifique se o META_VERIFY_TOKEN está correto.");
        return new NextResponse(null, { status: 403 }); // Retorna 'Forbidden' se a verificação falhar
    }
}

/**
 * Rota POST: Recebimento de Notificações de Leads
 * Esta é a rota principal que a Meta usará para te notificar sobre cada novo lead gerado.
 */
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    console.log('Webhook do Meta recebido:', JSON.stringify(body, null, 2));

    try {
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];

        // 1. Validação: Ignora qualquer notificação que não seja de 'leadgen'
        if (change?.field !== 'leadgen') {
            console.log("Ignorando notificação (não é um leadgen):", change?.field);
            return NextResponse.json({ status: 'not_a_leadgen_event' }, { status: 200 });
        }
        
        // Extrai os IDs necessários do payload da Meta
        const leadgenId = change.value.leadgen_id;
        const formId = change.value.form_id;
        const pageId = change.value.page_id;
        
        // 2. Busca o Token de Acesso à Página do ambiente
        const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
        if (!PAGE_ACCESS_TOKEN) {
            console.error("ERRO CRÍTICO: META_PAGE_ACCESS_TOKEN não está configurado no ambiente.");
            throw new Error("Token de Acesso à Página não configurado no servidor.");
        }

        // 3. Busca os detalhes do Lead na API de Marketing da Meta
        console.log(`Buscando detalhes do lead ID: ${leadgenId}`);
        const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadDetailsResponse.json();

        if (!leadDetailsResponse.ok) {
            console.error("Erro ao buscar detalhes do lead na API do Meta:", leadDetails);
            throw new Error(leadDetails.error?.message || "Falha ao buscar dados do lead no Meta.");
        }

        // 4. Extrai os dados do formulário (nome, email, telefone)
        const leadData = {};
        leadDetails.field_data.forEach(field => {
            const fieldName = field.name;
            const fieldValue = field.values[0];
            if (fieldName === 'full_name') leadData.nome = fieldValue;
            if (fieldName === 'email') leadData.email = fieldValue;
            if (fieldName === 'phone_number') leadData.telefone = fieldValue;
        });
        
        console.log("Dados do lead extraídos:", leadData);

        let contatoId = null;
        // Limpa o número de telefone, removendo caracteres não numéricos
        const telefoneLimpo = leadData.telefone?.replace(/\D/g, '');

        // 5. Verifica se o contato já existe no banco de dados pelo telefone
        if (telefoneLimpo) {
            const { data: existingPhone, error: phoneError } = await supabase
                .from('telefones')
                .select('contato_id')
                .eq('telefone', telefoneLimpo)
                .limit(1)
                .single();
            
            if (phoneError && phoneError.code !== 'PGRST116') { // Ignora o erro 'PGRST116' que significa "nenhuma linha encontrada"
                console.error("Erro ao buscar telefone existente:", phoneError);
            } else if (existingPhone) {
                contatoId = existingPhone.contato_id;
                console.log(`Contato já existente encontrado pelo telefone. ID: ${contatoId}`);
            }
        }
        
        // 6. Se o contato não existe, cria um novo
        if (!contatoId) {
            console.log("Nenhum contato encontrado. Criando um novo...");
            const { data: newContact, error: contactError } = await supabase
                .from('contatos')
                .insert({
                    nome: leadData.nome || `Lead Meta (${new Date().toLocaleDateString()})`,
                    origem: 'Meta Lead Ad', // Define a origem do lead
                    tipo_contato: 'Lead',
                    personalidade_juridica: 'Pessoa Física'
                })
                .select('id')
                .single();

            if (contactError) throw new Error(`Erro ao salvar novo contato: ${contactError.message}`);
            
            contatoId = newContact.id;
            console.log(`Novo contato criado com ID: ${contatoId}`);

            // Associa email e telefone ao novo contato criado
            if (leadData.email) {
                await supabase.from('emails').insert({ contato_id: contatoId, email: leadData.email, tipo: 'Principal' });
            }
            if (telefoneLimpo) {
                await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefoneLimpo, tipo: 'Celular' });
            }
        }

        // 7. Adiciona o contato ao Funil de Vendas (se ele ainda não estiver lá)
        if (contatoId) {
            const { data: existingFunnelEntry } = await supabase.from('contatos_no_funil').select('id').eq('contato_id', contatoId).limit(1).single();

            if (!existingFunnelEntry) {
                console.log(`Contato ID ${contatoId} não está no funil. Adicionando...`);
                
                // Busca o primeiro funil disponível
                const { data: funil } = await supabase.from('funis').select('id').order('created_at').limit(1).single();
                if (funil) {
                    // Busca a primeira coluna (etapa) desse funil
                    const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
                    if (primeiraColuna) {
                        const { error: funilError } = await supabase.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: primeiraColuna.id });
                        if (funilError) {
                            console.error('Erro ao adicionar contato ao funil do CRM:', funilError);
                        } else {
                            console.log('SUCESSO: Contato adicionado à primeira coluna do funil!');
                        }
                    } else {
                         console.error("Nenhuma coluna encontrada para o funil ID:", funil.id);
                    }
                } else {
                    console.error("Nenhum funil encontrado no sistema para adicionar o lead.");
                }
            } else {
                console.log(`Contato ID ${contatoId} já está no funil. Nenhuma ação necessária.`);
            }
        }

        // 8. Responde à Meta com status 200 (OK) para confirmar o recebimento
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (e) {
        console.error('Erro geral no processamento do webhook:', e);
        // É importante retornar 200 mesmo em caso de erro para que a Meta não desative o webhook.
        // O erro já foi logado no servidor para análise.
        return NextResponse.json({ status: 'error', message: e.message }, { status: 200 });
    }
}
