import { NextResponse } from 'next/server';
import { getBelvoClient } from '../../../../utils/belvo-factory';

export async function POST() {
    try {
        console.log("🔐 [BELVO TOKEN] Iniciando geração de token Open Finance...");

        const { client } = await getBelvoClient();
        
        // --- AQUI ESTÁ O SEGREDO QUE FALTAVA ---
        // Para Open Finance Brasil, precisamos enviar este objeto de configuração
        // Usei o CPF de teste da documentação oficial para o Sandbox funcionar
        const payload = {
            scopes: "read_institutions,write_links,read_consents,write_consents,write_consent_callback,delete_consents",
            stale_in: "300d", // Dados ficam salvos por 300 dias
            fetch_resources: ["ACCOUNTS", "TRANSACTIONS", "OWNERS"],
            widget: {
                purpose: "Conciliação bancária automática e gestão financeira do Studio 57.",
                openfinance_feature: "consent_link_creation",
                callback_urls: {
                    // Essas URLs são para onde a Belvo redirecionaria se fosse mobile
                    // No widget web, elas servem para sinalizar sucesso/erro internamente
                    success: "https://google.com", // Apenas placeholders válidos
                    exit: "https://google.com",
                    event: "https://google.com"
                },
                consent: {
                    terms_and_conditions_url: "https://www.google.com", // Substituir pelo seu link real futuramente
                    permissions: ["REGISTER", "ACCOUNTS", "CREDIT_CARDS", "CREDIT_OPERATIONS"],
                    identification_info: [
                        {
                            // CPF OFICIAL DE TESTE DO SANDBOX DA BELVO (Ralph Bragg)
                            // Quando formos para produção, substituiremos isso pelo CPF do cliente logado!
                            type: "CPF",
                            number: "76109277673", 
                            name: "Ralph Bragg"
                        }
                    ]
                }
            }
        };

        console.log("📤 Enviando payload para Belvo:", JSON.stringify(payload, null, 2));

        // Passamos o payload para a função create
        const response = await client.widgetToken.create(payload);

        console.log("✅ [BELVO TOKEN] Token gerado com sucesso!", response);
        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ ERRO FATAL ao gerar token Belvo:', error);
        
        // Log detalhado do erro da Belvo (geralmente eles dizem exatamente qual campo faltou)
        if (error.response) {
            console.error("Detalhes do erro Belvo:", JSON.stringify(error.response.data, null, 2));
        }

        return NextResponse.json(
            { 
                error: error.message || 'Erro interno ao conectar com a Belvo',
                details: error.response?.data || 'Sem detalhes'
            },
            { status: 500 }
        );
    }
}