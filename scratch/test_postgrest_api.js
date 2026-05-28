const crypto = require('crypto');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

// Função para assinar HS256 JWT manualmente
function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const base64UrlEncode = (str) => {
    return Buffer.from(JSON.stringify(str))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function main() {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!jwtSecret || !anonKey || !supabaseUrl) {
    console.error('Variáveis do Supabase não encontradas.');
    return;
  }

  // Claim JWT para o usuário Ranniere Campos na Org 2
  // ID: 3bfde802-b916-4ea6-a871-7436481bfd3f
  const payload = {
    role: 'authenticated',
    sub: '3bfde802-b916-4ea6-a871-7436481bfd3f',
    email: 'rannierecampos@studio57.arq.br',
    app_metadata: {
      provider: 'email',
      providers: ['email']
    },
    user_metadata: {},
    iss: 'supabase',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hora de validade
  };

  const token = signJWT(payload, jwtSecret);
  console.log('JWT Token gerado com sucesso.');

  // Fazer a requisição HTTP para o PostgREST do Supabase
  const url = `${supabaseUrl}/rest/v1/whatsapp_messages?contato_id=eq.5199&organizacao_id=eq.2&select=*`;
  
  console.log(`Fazendo requisição GET para: ${url}`);

  const options = {
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(url, options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`Status Code: ${res.statusCode}`);
      try {
        const json = JSON.parse(data);
        console.log(`Número de registros retornados: ${Array.isArray(json) ? json.length : 'Erro/Objeto'}`);
        console.log('Resposta da API:');
        console.log(json);
      } catch (e) {
        console.log('Resposta não-JSON:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Erro na requisição:', error);
  });

  req.end();
}

main().catch(console.error);
