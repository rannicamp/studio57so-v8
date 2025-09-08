import { createClient } from './supabase/server';
import { unstable_noStore as noStore } from 'next/cache';

export async function checkPermission(permissionKey) {
  noStore();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData } = await supabase
    .from('usuarios')
    .select('funcao_id')
    .eq('id', user.id)
    .single();

  if (!userData || !userData.funcao_id) {
    return false;
  }

  const { funcao_id } = userData;

  const { data: funcaoData } = await supabase
    .from('funcoes')
    .select('nome_funcao')
    .eq('id', funcao_id)
    .single();

  if (funcaoData?.nome_funcao === 'Proprietário') {
    return true;
  }

  // LÓGICA MELHORADA AQUI
  const { data: permissionData, error } = await supabase
    .from('permissoes')
    .select('pode_ver') // Agora selecionamos especificamente a coluna 'pode_ver'
    .eq('funcao_id', funcao_id)
    .eq('recurso', permissionKey)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao verificar permissão:', error);
    return false;
  }

  // Retorna true APENAS se a permissão for encontrada E 'pode_ver' for verdadeiro.
  return permissionData ? permissionData.pode_ver : false;
}