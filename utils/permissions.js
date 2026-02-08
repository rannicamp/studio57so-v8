// Local do Arquivo: utils/permissions.js
import { createClient } from '@/utils/supabase/server';
import { unstable_noStore as noStore } from 'next/cache';

/**
 * Verifica se o usuário logado tem permissão para um recurso específico.
 * (Usado para proteger páginas e componentes)
 */
export async function checkPermission(permissionKey) {
  noStore();
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: userData } = await supabase
    .from('usuarios')
    .select('funcao_id')
    .eq('id', user.id)
    .single();

  if (!userData?.funcao_id) return false;

  const { funcao_id } = userData;

  // Super Admin (Proprietário)
  const { data: funcaoData } = await supabase
    .from('funcoes')
    .select('nome_funcao')
    .eq('id', funcao_id)
    .single();

  if (funcaoData?.nome_funcao === 'Proprietário') return true;

  // Permissão Específica
  const { data: permissionData, error } = await supabase
    .from('permissoes')
    .select('pode_ver')
    .eq('funcao_id', funcao_id)
    .eq('recurso', permissionKey)
    .single();

  if (error && error.code !== 'PGRST116') return false;

  return permissionData ? permissionData.pode_ver : false;
}

/**
 *  BUSCA IDS POR FUNÇÃO (CARGO)
 * Mapeia grupos de aviso (ex: 'comercial') para os cargos reais do banco (ex: 'Corretor').
 */
export async function buscarIdsPorPermissao(permissionKey, organizacaoId = null) {
  const supabase = createClient();
  let listaFuncoesIds = new Set(); // Usamos Set para evitar duplicatas

  // 1. Busca por Permissão Técnica (Tabela 'permissoes')
  // Isso cobre casos onde você marcou manualmente que um cargo pode ver uma tela
  const { data: funcoesPermitidas } = await supabase
    .from('permissoes')
    .select('funcao_id')
    .eq('recurso', permissionKey)
    .eq('pode_ver', true);

  if (funcoesPermitidas) {
    funcoesPermitidas.forEach(f => listaFuncoesIds.add(f.funcao_id));
  }

  // 2. Busca por Nome do Cargo (Mapeamento Baseado no seu Banco de Dados)
  let termosBusca = [];
  
  // Mapeamento exato conforme seus cargos no banco (funcoes_rows.sql)
  switch (permissionKey) {
    case 'comercial':
    case 'vendas':
      // Quem recebe LEAD e avisos de VENDA?
      termosBusca = ['Corretor', 'Gerente de Vendas', 'Comercial', 'Coordenador de Marketing'];
      break;

    case 'financeiro':
      // Quem cuida do DINHEIRO?
      termosBusca = ['Analista Financeiro', 'Gerente Financeiro', 'Financeiro'];
      break;

    case 'obras':
    case 'engenharia':
      // Quem cuida da OBRA?
      termosBusca = ['Engenheiro', 'Mestre de Obras', 'Fiscal', 'Projetista', 'Pedreiro', 'Eletricista', 'Encanador']; 
      // (Adicionei operacionais caso queira avisar mestre de obras, mas pode filtrar se quiser só gestão)
      break;
      
    case 'admin':
    case 'administrativo':
      termosBusca = ['Administrativo', 'Proprietário'];
      break;
      
    case 'suprimentos':
    case 'compras':
      termosBusca = ['Comprador', 'Almoxarife'];
      break;
  }

  if (termosBusca.length > 0) {
    // Cria filtro OR: nome_funcao.ilike.%Corretor%, etc.
    const filtro = termosBusca.map(t => `nome_funcao.ilike.%${t}%`).join(',');
    
    const { data: funcoesPorNome } = await supabase
      .from('funcoes')
      .select('id')
      .or(filtro);
    
    if (funcoesPorNome) {
      funcoesPorNome.forEach(f => listaFuncoesIds.add(f.id));
    }
  }

  // 3. Sempre inclui o Proprietário (ID 1 ou pelo nome)
  const { data: funcProprietario } = await supabase
    .from('funcoes')
    .select('id')
    .eq('nome_funcao', 'Proprietário')
    .single();
    
  if (funcProprietario) {
    listaFuncoesIds.add(funcProprietario.id);
  }

  // Se não achou cargos, retorna vazio
  if (listaFuncoesIds.size === 0) return [];

  // 4. Busca os Usuários desses cargos
  let query = supabase
    .from('usuarios')
    .select('id')
    .in('funcao_id', Array.from(listaFuncoesIds))
    .eq('is_active', true); // Apenas ativos

  if (organizacaoId) {
    query = query.eq('organizacao_id', organizacaoId);
  }

  const { data: usuarios } = await query;

  if (!usuarios) return [];
  
  return usuarios.map(u => u.id);
}
