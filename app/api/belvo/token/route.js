import { NextResponse } from 'next/server';
import { belvoRequest } from '../../../../utils/belvo-http';

export async function POST(request) {
    try {
        // Pega a origem para o callback
        let origin = 'http://localhost:3000';
        try { origin = new URL(request.url).origin; } catch (e) {}

        // Payload Obrigatório para Open Finance Brasil (OFDA)
        const payload = {
            scopes: "read_institutions,write_links,read_consents,write_consents,write_consent_callback,delete_consents",
            stale_in: "300d", // Dados cacheados por 300 dias
            fetch_resources: ["ACCOUNTS", "TRANSACTIONS", "OWNERS", "BALANCES"],
            widget: {
                purpose: "Gestão Financeira e Conciliação Studio 57",
                openfinance_feature: "consent_link_creation",
                callback_urls: {
                    success: `${origin}/financeiro/contas?status=success`,
                    exit: `${origin}/financeiro/contas?status=exit`,
                    event: `${origin}/financeiro/contas?status=event`
                },
                consent: {
                    // Link real dos termos da sua empresa deve vir aqui
                    terms_and_conditions_url: "https://studio57.com.br/termos", 
                    permissions: ["REGISTER", "ACCOUNTS", "CREDIT_CARDS", "CREDIT_OPERATIONS", "BALANCES", "TRANSACTIONS"],
                    identification_info: [
                        {
                            // Em produção, isso deve vir dinamicamente do cadastro do usuário!
                            type: "CPF",
                            number: "76109277673", // CPF Ralph Bragg (Sandbox)
                            name: "Ralph Bragg"
                        }
                    ]
                }
            }
        };

        // Usa nosso cliente robusto
        const data = await belvoRequest('/api/token/', {
            method: 'POST',
            body: payload
        });

        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}