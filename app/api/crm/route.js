// app/api/crm/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMetaEvent } from '@/utils/metaCapi';

// Configuração do Supabase com Service Role
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- FUNÇÃO AUXILIAR: Enviar Template WhatsApp ---
async function sendTemplateMessage(config, to, contato, templateName, language) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    
    // Tratamento de segurança para o nome do contato
    const nomeExibicao = contato?.nome || contato?.razao_social || 'Cliente';

    const components = [{
        type: 'body',
        parameters: [{
            type: 'text',
            text: nomeExibicao
        }]
    }];
    const payload = {
        messaging_product: "whatsapp", to: to, type: "template",
        template: { name: templateName, language: { code: language }, components: components }
    };

    try {
        const response = await fetch(url, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${config.whatsapp_permanent_token}` 
            }, 
            body: JSON.stringify(payload) 
        });
        const responseData = await response.json();

        if (!response.ok) {
            console.error(`❌ [WhatsApp] Erro API:`, responseData.error?.message);
        } else {
            console.log(`✅ [WhatsApp] Automação enviada para ${to}`);
            const messageId = responseData.messages?.[0]?.id;
            if (messageId && contato?.id) {
                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: contato.id, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to,
                    content: `(Automação) Template: ${templateName}`, direction: 'outbound', status: 'sent', raw_payload: payload,
                    sent_at: new Date().toISOString(), organizacao_id: config.organizacao_id
                });
            }
        }
    } catch (error) {
        console.error(`❌ [WhatsApp] Erro de rede:`, error);
    }
}

// Rotas não utilizadas
export async function GET(req) { return NextResponse.json({ message: "GET não implementado" }); }
export async function POST(req) { return NextResponse.json({ message: "POST não implementado" }); }
export async function DELETE(req) { return NextResponse.json({ message: "DELETE não implementado" }); }

// --- ROTA PUT: O CÉREBRO DA OPERAÇÃO ---
export async function PUT(req) {
    const body = await req.json();
    const { organizacaoId, ...params } = body;

    // CENÁRIO: MOVER CARD DE COLUNA
    if (params.contatoNoFunilId && params.novaColunaId) {
        console.log(`🔄 [CRM] Movendo card ${params.contatoNoFunilId} para coluna ${params.novaColunaId}`);

        try {
            // 1. ATUALIZAÇÃO NO BANCO (Move o Card)
            const { error: moveError } = await supabaseAdmin
                .from('contatos_no_funil')
                .update({ coluna_id: params.novaColunaId, updated_at: new Date().toISOString() })
                .eq('id', params.contatoNoFunilId)
                .eq('organizacao_id', organizacaoId);

            if (moveError) throw moveError;

            // 2. BUSCA DE DADOS COMPLETOS
            // Usamos a notação !...fkey para especificar a relação correta
            const { data: fullData, error: fetchError } = await supabaseAdmin
                .from('contatos_no_funil')
                .select(`
                    contato_id,
                    coluna_id,
                    contatos!contatos_no_funil_contato_id_fkey (
                        id, nome, razao_social, origem,
                        telefones (telefone),
                        emails (email)
                    ),
                    colunas_funil (id, nome)
                `)
                .eq('id', params.contatoNoFunilId)
                .single();

            if (fetchError || !fullData) {
                console.error("❌ [CRM] Erro ao buscar dados interligados:", fetchError);
            } else {
                const contato = fullData.contatos; 
                const coluna = fullData.colunas_funil;
                
                const telefone = contato?.telefones?.length > 0 ? contato.telefones[0].telefone : null;
                const email = contato?.emails?.length > 0 ? contato.emails[0].email : null;
                const nomeContato = contato?.nome || contato?.razao_social || 'Desconhecido';
                const nomeColuna = coluna?.nome?.toLowerCase() || '';
                const colunaId = coluna?.id;

                console.log(`📊 [CRM] Cliente: ${nomeContato} | Nova Coluna: ${coluna.nome}`);

                // --- 🚀 ESTRATÉGIA FACEBOOK CAPI (Pixel) ---
                
                // ID OFICIAL DA COLUNA VENDIDO: 5bdd47f6-35d6-4662-93f2-f7c0fc4ba60e
                const isVendido = 
                    nomeColuna.includes('vendido') || 
                    nomeColuna.includes('venda realizada') || 
                    colunaId === '5bdd47f6-35d6-4662-93f2-f7c0fc4ba60e'; 

                if (isVendido) {
                    console.log(`💰 [PIXEL] VENDA IDENTIFICADA! Buscando contrato...`);
                    
                    // --- NOVA LÓGICA: BUSCA VALOR NO CONTRATO ---
                    let valorReal = 350000.00; // Valor de fallback (Médio)
                    
                    // Busca o contrato mais recente deste cliente
                    const { data: contratoData, error: contratoError } = await supabaseAdmin
                        .from('contratos')
                        .select('valor_final_venda')
                        .eq('contato_id', contato.id)
                        .order('created_at', { ascending: false }) // Pega o último criado
                        .limit(1)
                        .maybeSingle();

                    if (contratoData && contratoData.valor_final_venda) {
                        valorReal = contratoData.valor_final_venda;
                        console.log(`💲 [PIXEL] Sucesso! Valor exato do contrato: R$ ${valorReal}`);
                    } else {
                        console.warn(`⚠️ [PIXEL] Contrato não encontrado. Usando valor padrão: R$ ${valorReal}`);
                    }

                    // Envia evento com o VALOR REAL
                    await sendMetaEvent('Purchase', {
                        email: email,
                        telefone: telefone,
                        primeiro_nome: nomeContato?.split(' ')[0],
                        sobrenome: nomeContato?.split(' ').slice(1).join(' '),
                    }, {
                        value: valorReal,
                        currency: 'BRL',
                        content_name: `Venda - ${coluna.nome}`,
                        status: 'Concluído'
                    });
                }
                
                // LEAD PERDIDO
                else if (nomeColuna.includes('perdido') || nomeColuna.includes('perda') || nomeColuna.includes('desistência')) {
                    console.log(`🚫 [PIXEL] Lead Perdido.`);
                    await sendMetaEvent('LeadLost', { email, telefone }, { reason: coluna.nome });
                }
                
                // AGENDAMENTO
                else if (nomeColuna.includes('visita') || nomeColuna.includes('agendado')) {
                    console.log(`📅 [PIXEL] Visita Agendada.`);
                    await sendMetaEvent('Schedule', { email, telefone });
                }

                // --- 🤖 AUTOMAÇÃO WHATSAPP (Mantida) ---
                const { data: automacoes } = await supabaseAdmin
                    .from('automacoes')
                    .select('*')
                    .eq('organizacao_id', organizacaoId)
                    .eq('ativo', true)
                    .eq('gatilho_tipo', 'MOVER_COLUNA')
                    .eq('gatilho_config->>coluna_id', params.novaColunaId);

                if (automacoes?.length > 0 && telefone) {
                    const { data: orgConfig } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').eq('organizacao_id', organizacaoId).single();
                    if (orgConfig) {
                        for (const regra of automacoes) {
                            if (regra.acao_tipo === 'ENVIAR_WHATSAPP') {
                                console.log(`🤖 [Automação] Disparando template: ${regra.acao_config.template_nome}`);
                                await sendTemplateMessage(orgConfig, telefone, contato, regra.acao_config.template_nome, regra.acao_config.template_idioma);
                            }
                        }
                    }
                }
            }

            return NextResponse.json({ message: "Contato movido com sucesso." });

        } catch (error) {
            console.error("❌ [CRM] Erro Crítico no PUT:", error);
            return NextResponse.json({ error: 'Erro no servidor: ' + error.message }, { status: 500 });
        }
    }

    // --- MANIPULAÇÃO DE COLUNAS (Renomear/Reordenar) ---
    if (params.columnId && params.newName) {
        const { error } = await supabaseAdmin.from('colunas_funil').update({ nome: params.newName }).eq('id', params.columnId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ message: "Renomeado." });
    }

    if (params.reorderColumns) {
        for (const col of params.reorderColumns) {
            await supabaseAdmin.from('colunas_funil').update({ ordem: col.ordem }).eq('id', col.id);
        }
        return NextResponse.json({ message: "Reordenado." });
    }

    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
}