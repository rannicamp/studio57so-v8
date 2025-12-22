import { NextResponse } from 'next/server';
import { belvoRequest } from '../../../../utils/belvo-http';

export async function POST(request) {
    try {
        const { origin } = new URL(request.url);

        // Configuração obrigatória para Open Finance Brasil (OFDA)
        const payload = {
            scopes: "read_institutions,write_links,read_consents,write_consents,write_consent_callback,delete_consents",
            stale_in: "300d",
            fetch_resources: ["ACCOUNTS", "TRANSACTIONS", "OWNERS", "BALANCES"],
            widget: {
                purpose: "Gestão e Conciliação Financeira Studio 57",
                openfinance_feature: "consent_link_creation",
                callback_urls: {
                    success: `${origin}/financeiro/contas?status=success`,
                    exit: `${origin}/financeiro/contas?status=exit`,
                    event: `${origin}/financeiro/contas?status=event`
                },
                consent: {
                    terms_and_conditions_url: "https://studio57.com.br/termos",
                    permissions: ["REGISTER", "ACCOUNTS", "CREDIT_CARDS", "CREDIT_OPERATIONS", "BALANCES", "TRANSACTIONS"],
                    identification_info: [
                        {
                            type: "CPF",
                            number: "76109277673", // CPF de Teste para Sandbox
                            name: "Ralph Bragg"
                        }
                    ]
                }
            }
        };

        const data = await belvoRequest('/api/token/', {
            method: 'POST',
            body: payload
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error("❌ Erro na Rota de Token:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}