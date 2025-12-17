import { NextResponse } from 'next/server';
import { PluggyClient } from 'pluggy-sdk';

// Inicializa o cliente da Pluggy com as chaves que vamos colocar no .env
const pluggyClient = new PluggyClient({
  clientId: process.env.PLUGGY_CLIENT_ID,
  clientSecret: process.env.PLUGGY_CLIENT_SECRET,
});

export async function POST(req) {
  try {
    // Cria um token temporário para o Widget funcionar no frontend
    const data = await pluggyClient.createConnectToken();
    
    return NextResponse.json({ accessToken: data.accessToken });
  } catch (error) {
    console.error('Erro ao criar token da Pluggy:', error);
    return NextResponse.json(
      { error: 'Falha ao criar sessão de conexão bancária.' }, 
      { status: 500 }
    );
  }
}