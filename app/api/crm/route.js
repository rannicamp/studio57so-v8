// app/api/crm/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos a Service Key para operações de backend seguras
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// ##### FUNÇÃO AUXILIAR PARA ENVIAR WHATSAPP #####
async function sendTemplateMessage(config, to, contato, templateName, language) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    // Preenche a variável {{1}} com o nome do contato ou um texto padrão
    const components = [{
        type: 'body',
        parameters: [{
            type: 'text',
            text: contato.nome || contato.razao_social || 'Prezado(a)'
        }]
    }];
    const payload = {
        messaging_product: "whatsapp", to: to, type: "template",
        template: { name: templateName, language: { code: language }, components: components }
    };

    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();

        if (!response.ok) {
            console.error(`ERRO API WHATSAPP (Automação):`, responseData.error?.message);
            return;
        }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contato.id, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to,
                content: `(Automação) Template: ${templateName}`, direction: 'outbound', status: 'sent', raw_payload: payload,
                sent_at: new Date().toISOString(), organizacao_id: config.organizacao_id
            });
            console.log(`[Automação] Template ${templateName} enviado para o contato ${contato.id}.`);
        }
    } catch (error) {
        console.error(`[Automação] Erro de rede ao enviar template:`, error);
    }
}
// ##### FIM DA FUNÇÃO AUXILIAR #####


// As funções GET, POST e DELETE permanecem como estavam, pois não se relacionam com a automação de mover card.
// ... (cole aqui as suas funções GET, POST e DELETE originais e sem alterações)
export async function GET(req) {
    // ... seu código original ...
}
export async function POST(req) {
    // ... seu código original ...
}
export async function DELETE(req) {
    // ... seu código original ...
}


// Função para ATUALIZAR dados (AQUI ESTÁ NOSSA MUDANÇA!)
export async function PUT(req) {
    const body = await req.json();
    const { organizacaoId, ...params } = body; // Separamos o ID da organização

    // Lógica para mover o contato (agora com automação!)
    if (params.contatoNoFunilId && params.novaColunaId) {
        try {
            // 1. Move o card de contato
            const { error: moveError } = await supabaseAdmin
                .from('contatos_no_funil')
                .update({ coluna_id: params.novaColunaId, updated_at: new Date().toISOString() })
                .eq('id', params.contatoNoFunilId)
                .eq('organizacao_id', organizacaoId);

            if (moveError) throw moveError;

            // ##### INÍCIO DA LÓGICA DE AUTOMAÇÃO #####
            // 2. Busca por automações que correspondam ao gatilho
            const { data: automacoes, error: automacaoError } = await supabaseAdmin
                .from('automacoes')
                .select('*')
                .eq('organizacao_id', organizacaoId)
                .eq('ativo', true)
                .eq('gatilho_tipo', 'MOVER_COLUNA')
                .eq('gatilho_config->>coluna_id', params.novaColunaId);

            if (automacaoError) throw automacaoError;
            
            if (automacoes && automacoes.length > 0) {
                const { data: whatsappConfig } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').eq('organizacao_id', organizacaoId).single();
                if (!whatsappConfig) {
                    console.warn(`[Automação] WhatsApp não configurado para a organização.`);
                } else {
                    const { data: contatoInfo } = await supabaseAdmin.from('contatos_no_funil').select('contatos(*, telefones(telefone))').eq('id', params.contatoNoFunilId).single();
                    const contato = contatoInfo?.contatos;
                    const telefone = contato?.telefones?.[0]?.telefone;

                    if (telefone) {
                        for (const regra of automacoes) {
                            if (regra.acao_tipo === 'ENVIAR_WHATSAPP') {
                                const { template_nome, template_idioma } = regra.acao_config;
                                await sendTemplateMessage(whatsappConfig, telefone, contato, template_nome, template_idioma);
                            }
                        }
                    } else {
                        console.warn(`[Automação] Contato ${contato?.id} não possui telefone.`);
                    }
                }
            }
            // ##### FIM DA LÓGICA DE AUTOMAÇÃO #####

            return NextResponse.json({ message: "Contato movido com sucesso." });
        } catch (error) {
            return NextResponse.json({ error: 'Erro no servidor ao mover contato: ' + error.message }, { status: 500 });
        }
    }

    // Lógica para renomear uma coluna (mantida como original)
    if (params.columnId && params.newName) {
        // ... (seu código original)
    }

    // Lógica para reordenar colunas (mantida como original)
    if (params.reorderColumns && params.funilId) {
        // ... (seu código original)
    }

    return NextResponse.json({ error: 'Parâmetros inválidos para a requisição PUT.' }, { status: 400 });
}