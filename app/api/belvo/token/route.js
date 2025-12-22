import { NextResponse } from 'next/server';
import { getBelvoClient } from '../../../../utils/belvo-factory';

export async function POST(request) {
    try {
        // Pega a URL do site atual para saber onde voltar
        const { origin } = new URL(request.url);
        
        const { client } = await getBelvoClient();
        
        const payload = {
            scopes: "read_institutions,write_links,read_consents,write_consents,write_consent_callback,delete_consents",
            stale_in: "300d",
            fetch_resources: ["ACCOUNTS", "TRANSACTIONS", "OWNERS"],
            widget: {
                purpose: "Conciliação bancária automática do Studio 57.",
                openfinance_feature: "consent_link_creation",
                callback_urls: {
                    // Mágica: Redireciona de volta para o seu site com parâmetros
                    success: `${origin}/financeiro/contas?status=success`,
                    exit: `${origin}/financeiro/contas?status=exit`,
                    event: `${origin}/financeiro/contas?status=event`
                },
                consent: {
                    terms_and_conditions_url: "https://www.google.com", // Link temporário
                    permissions: ["REGISTER", "ACCOUNTS", "CREDIT_CARDS", "CREDIT_OPERATIONS"],
                    identification_info: [
                        {
                            type: "CPF",
                            number: "76109277673", // CPF DE TESTE (SANDBOX)
                            name: "Ralph Bragg"
                        }
                    ]
                }
            }
        };

        const response = await client.widgetToken.create(payload);
        return NextResponse.json(response);

    } catch (error) {
        console.error('Erro Belvo Token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}