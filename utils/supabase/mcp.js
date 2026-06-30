import crypto from 'crypto';
import * as jose from 'jose';
import { createClient as createBaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './server';

/**
 * Valida uma chave de API do usuário, atualiza seu uso e retorna o cliente do Supabase
 * autenticado com o JWT customizado atrelado a esse usuário e organização.
 * 
 * @param {string} apiKey Chave de API crua (ex: elo57_usr_key_abc123...)
 * @returns {Promise<{ supabase: any, user: { id: string, organizacao_id: number } }|null>}
 */
export async function authenticateMcpKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null;

  // 1. Calcular o SHA-256 da chave fornecida para buscar de forma segura no banco
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const adminClient = createAdminClient();

  // 2. Buscar a chave no banco de dados usando o cliente admin
  const { data: keyRecord, error } = await adminClient
    .from('user_api_keys')
    .select('id, usuario_id, organizacao_id, expires_at, ativo')
    .eq('key_hash', keyHash)
    .single();

  if (error || !keyRecord) {
    console.error('[MCP Auth] Chave de API inválida ou não encontrada.', error?.message);
    return null;
  }

  // 3. Validar status e expiração
  if (!keyRecord.ativo) {
    console.error('[MCP Auth] Chave de API inativa.');
    return null;
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    console.error('[MCP Auth] Chave de API expirada.');
    return null;
  }

  // 4. Atualizar o campo last_used_at de forma assíncrona (background)
  adminClient
    .from('user_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(({ error: updateErr }) => {
      if (updateErr) console.warn('[MCP Auth] Falha ao atualizar last_used_at:', updateErr.message);
    });

  // 5. Gerar o JWT do Supabase assinado com a nossa SUPABASE_JWT_SECRET
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET não está definida nas variáveis de ambiente do servidor.');
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const userJwt = await new jose.SignJWT({
    role: 'authenticated',
    aud: 'authenticated',
    sub: keyRecord.usuario_id,
    user_metadata: {
      organizacao_id: keyRecord.organizacao_id
    }
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h') // Token expira em 2 horas
    .sign(secret);

  // 6. Instanciar o cliente do Supabase passando o JWT personalizado
  const supabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${userJwt}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  return {
    supabase,
    user: {
      id: keyRecord.usuario_id,
      organizacao_id: Number(keyRecord.organizacao_id)
    }
  };
}
