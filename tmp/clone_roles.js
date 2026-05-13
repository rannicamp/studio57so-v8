
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const orgId = 2;
  
  // 1. Get all roles from org 1
  const { data: org1Roles } = await supabaseAdmin.from('funcoes').select('*').eq('organizacao_id', 1).neq('id', 1);
  console.log('Roles from Org 1 to clone:', org1Roles.map(r => r.nome_funcao).join(', '));
  
  // 2. For each role, create a copy in org 2
  for (const role of org1Roles) {
    // Check if it already exists in org 2 to prevent duplicates
    const { data: existing } = await supabaseAdmin.from('funcoes').select('id').eq('organizacao_id', orgId).eq('nome_funcao', role.nome_funcao);
    if (existing && existing.length > 0) continue;

    const { data: newRole, error: errRole } = await supabaseAdmin.from('funcoes').insert({
      nome_funcao: role.nome_funcao,
      descricao: role.descricao,
      organizacao_id: orgId
    }).select().single();
    
    if (errRole) { console.error('Error inserting role', errRole); continue; }
    console.log('Created role', newRole.nome_funcao, 'with ID', newRole.id);

    // 3. Update users in org 2 that had the old role ID
    const { error: errUpdate } = await supabaseAdmin.from('usuarios').update({ funcao_id: newRole.id }).eq('organizacao_id', orgId).eq('funcao_id', role.id);
    if (errUpdate) console.error('Error updating users', errUpdate);

    // 4. Copy permissions for this role
    const { data: oldPerms } = await supabaseAdmin.from('permissoes').select('*').eq('funcao_id', role.id);
    if (oldPerms && oldPerms.length > 0) {
      const newPerms = oldPerms.map(p => ({
        funcao_id: newRole.id,
        recurso: p.recurso,
        pode_ver: p.pode_ver,
        pode_criar: p.pode_criar,
        pode_editar: p.pode_editar,
        pode_excluir: p.pode_excluir,
        organizacao_id: orgId
      }));
      await supabaseAdmin.from('permissoes').insert(newPerms);
    }
  }
  console.log('Cloning complete for Org 2.');
}
run();

