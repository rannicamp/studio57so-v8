import { createClient } from '../../../../utils/supabase/server';
import RdoListManager from '../../../../components/RdoListManager';
import Link from 'next/link';

export default async function ManageRdosPage() {
  const supabase = createClient();

  // 1. Busca os RDOs e os dados relacionados (empreendimento e usuário)
  // O PORQUÊ: Adicionamos 'usuarios ( nome, sobrenome )' para buscar
  // os dados do usuário usando a nova coluna de relacionamento.
  const { data: rdos, error: rdosError } = await supabase
    .from('diarios_obra')
    .select(`
      *,
      empreendimentos ( nome ),
      usuarios ( nome, sobrenome )
    `)
    .order('data_relatorio', { ascending: false });

  // 2. Busca a lista de todos os empreendimentos para o filtro
  const { data: empreendimentos, error: empreendimentosError } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .order('nome');

  // 3. Busca a lista de todos os usuários para o filtro de responsáveis
  // O PORQUÊ: Em vez de buscar e-mails duplicados da tabela de RDOs,
  // agora buscamos uma lista limpa e completa de todos os usuários cadastrados.
  // Isso torna o filtro mais poderoso e correto.
  const { data: todosUsuarios, error: usuariosError } = await supabase
    .from('usuarios')
    .select('id, nome, sobrenome')
    .order('nome');

  if (rdosError || empreendimentosError || usuariosError) {
    console.error('Erro ao buscar dados para o gerenciador de RDO:', { rdosError, empreendimentosError, usuariosError });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Diários de Obra</h1>
        <Link href="/rdo" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Novo RDO
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <RdoListManager 
          initialRdos={rdos || []}
          empreendimentosList={empreendimentos || []}
          // Passamos a lista de objetos de usuário para o componente
          responsaveisList={todosUsuarios || []}
        />
      </div>
    </div>
  );
}