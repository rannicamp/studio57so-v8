import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp/keys
 * Lista as chaves de API do usuário autenticado.
 */
export async function GET() {
  const supabase = await createClient();

  // 1. Validar autenticação
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });
  }

  // 2. Buscar as chaves do usuário
  const { data: keys, error } = await supabase
    .from('user_api_keys')
    .select('id, nome, key_preview, created_at, expires_at, last_used_at, ativo')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[MCP Keys API] Erro ao buscar chaves:', error.message);
    return new Response(JSON.stringify({ error: 'Erro ao buscar chaves.' }), { status: 500 });
  }

  return new Response(JSON.stringify(keys), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * POST /api/mcp/keys
 * Cria uma nova chave de API para o usuário.
 */
export async function POST(request) {
  const supabase = await createClient();

  // 1. Validar autenticação
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });
  }

  try {
    const { nome, expiracaoDias } = await request.json();
    if (!nome || typeof nome !== 'string') {
      return new Response(JSON.stringify({ error: 'O nome da chave é obrigatório.' }), { status: 400 });
    }

    // 2. Obter a organização do usuário
    const { data: usuario, error: userErr } = await supabase
      .from('usuarios')
      .select('organizacao_id')
      .eq('id', user.id)
      .single();

    if (userErr || !usuario?.organizacao_id) {
      return new Response(JSON.stringify({ error: 'Organização não encontrada para o usuário.' }), { status: 400 });
    }

    // 3. Gerar a chave crua
    const randomHex = crypto.randomBytes(24).toString('hex');
    const cleanKey = `elo57_usr_key_${randomHex}`;
    const keyHash = crypto.createHash('sha256').update(cleanKey).digest('hex');
    const keyPreview = `elo57_usr_key_...${cleanKey.slice(-6)}`;

    // Calcular data de expiração (se fornecida)
    let expiresAt = null;
    if (expiracaoDias && Number(expiracaoDias) > 0) {
      const date = new Date();
      date.setDate(date.getDate() + Number(expiracaoDias));
      expiresAt = date.toISOString();
    }

    // 4. Salvar no banco de dados
    const { data: newKey, error: insertErr } = await supabase
      .from('user_api_keys')
      .insert({
        usuario_id: user.id,
        organizacao_id: usuario.organizacao_id,
        key_hash: keyHash,
        key_preview: keyPreview,
        nome,
        expires_at: expiresAt,
        ativo: true
      })
      .select('id, nome, key_preview, created_at')
      .single();

    if (insertErr) {
      console.error('[MCP Keys API] Erro ao inserir chave:', insertErr.message);
      return new Response(JSON.stringify({ error: 'Erro ao criar a chave no banco de dados.' }), { status: 500 });
    }

    // 5. Retornar os dados da chave juntamente com a chave crua (APENAS ESTA VEZ!)
    return new Response(JSON.stringify({
      ...newKey,
      keyRaw: cleanKey // A chave em texto limpo para o usuário copiar
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[MCP Keys API] Erro interno:', err);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor.' }), { status: 500 });
  }
}

/**
 * DELETE /api/mcp/keys
 * Revoga (exclui) uma chave de API do usuário.
 */
export async function DELETE(request) {
  const supabase = await createClient();

  // 1. Validar autenticação
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });
  }

  const url = new URL(request.url);
  const keyId = url.searchParams.get('id');

  if (!keyId) {
    return new Response(JSON.stringify({ error: 'ID da chave não fornecido.' }), { status: 400 });
  }

  // 2. Excluir a chave (o RLS garante que o usuário só pode deletar as suas próprias chaves)
  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('id', keyId);

  if (error) {
    console.error('[MCP Keys API] Erro ao excluir chave:', error.message);
    return new Response(JSON.stringify({ error: 'Erro ao excluir chave.' }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, message: 'Chave revogada com sucesso.' }), { status: 200 });
}
