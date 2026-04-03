// Caminho: app/api/aps/token/route.js
import { NextResponse } from 'next/server';

export async function GET() {
 try {
 const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;

 if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
 return NextResponse.json(
 { error: 'Credenciais da Autodesk não configuradas no .env.local' },
 { status: 500 }
 );
 }

 // Define os escopos necessários.
 // Para visualizar e gerenciar buckets/objetos, precisamos destes:
 const scopes = 'data:read data:write data:create bucket:create bucket:read viewables:read';

 // Codifica as credenciais em Base64 para o cabeçalho Authorization
 const credentials = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString('base64');

 // Faz a chamada para a API da Autodesk (OAuth 2.0)
 const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 'Authorization': `Basic ${credentials}`,
 },
 body: new URLSearchParams({
 grant_type: 'client_credentials',
 scope: scopes,
 }),
 });

 if (!response.ok) {
 const errorText = await response.text();
 console.error('[APS Token Fetch Error]', response.status, errorText);
 try {
 const errorData = JSON.parse(errorText);
 throw new Error(errorData.developerMessage || errorData.reason || `Falha ao obter token da Autodesk (${response.status})`);
 } catch (e) {
 throw new Error(`Falha ao obter token da Autodesk HTTP ${response.status}: ${errorText}`);
 }
 }

 const data = await response.json();

 // Retorna o token para quem chamou (o visualizador)
 // data.access_token é o que importa
 // data.expires_in diz quanto tempo falta para expirar (geralmente 3599 segundos)
 return NextResponse.json(data);

 } catch (error) {
 console.error('[APS Token Error]:', error);
 return NextResponse.json(
 { error: 'Erro interno ao autenticar com Autodesk: ' + error.message },
 { status: 500 }
 );
 }
}