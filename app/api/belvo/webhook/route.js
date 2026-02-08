import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        console.log("🔔 [WEBHOOK BELVO] Recebendo notificação...");

        // 1. Verificação de Segurança (A senha que você criou)
        // A Belvo manda a senha no cabeçalho 'Authorization'
        const authHeader = request.headers.get('authorization');
        
        // A senha pode vir sozinha ou com "Bearer " antes
        const senhaConfigurada = 'Srbr19010720@';
        
        const isAuthorized = authHeader === senhaConfigurada || authHeader === `Bearer ${senhaConfigurada}`;

        if (!isAuthorized) {
            console.warn(`⛔ [WEBHOOK BELVO] Acesso negado. Senha recebida: ${authHeader}`);
            // Mesmo se a senha estiver errada, no início, respondemos 200 para não travar o painel da Belvo,
            // mas logamos o aviso. Quando estiver em produção real, mudamos para 401.
            return NextResponse.json({ received: false, error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Lê os dados que a Belvo mandou
        const body = await request.json();
        const evento = body.type;
        const dados = body.data;

        console.log(`✅ [WEBHOOK BELVO] Evento: ${evento} | ID: ${dados?.id}`);

        // 3. Lógica de Processamento (Futuro)
        // Aqui futuramente vamos colocar: "Se chegou novas transações, salva no banco"
        if (evento === 'transactions.new') {
            console.log("💰 Novas transações disponíveis para sincronizar!");
        }

        // 4. Resposta de Sucesso
        // É OBRIGATÓRIO responder com status 200, senão a Belvo acha que o servidor caiu e para de mandar.
        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error) {
        console.error("❌ [WEBHOOK BELVO] Erro interno:", error);
        // Respondemos 200 mesmo com erro interno para evitar que a Belvo bloqueie o webhook por excesso de falhas
        return NextResponse.json({ received: true, error: error.message }, { status: 200 });
    }
}

// Opcional: Responder a GET para testes manuais no navegador
export async function GET() {
    return NextResponse.json({ status: 'Webhook Belvo Online', message: 'Use POST para enviar eventos.' });
}