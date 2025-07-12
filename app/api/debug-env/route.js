// app/api/debug-env/route.js

import { NextResponse } from 'next/server';

export async function GET(request) {
  // Lê as variáveis de ambiente exatamente como o webhook tenta fazer.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Monta uma resposta segura, sem expor a chave secreta inteira.
  const debugInfo = {
    supabaseUrl: supabaseUrl || "NÃO ENCONTRADA",
    serviceRoleKey_Present: !!serviceRoleKey, // Mostra true se a chave existe, false se não
    serviceRoleKey_Length: serviceRoleKey ? serviceRoleKey.length : 0, // Mostra o tamanho da chave encontrada
    whatsappVerifyToken: whatsappVerifyToken || "NÃO ENCONTRADA",
  };

  // Loga a informação completa no servidor para você ver nos logs da Netlify
  console.log("DEBUG ENV:", debugInfo);

  return NextResponse.json(debugInfo);
}