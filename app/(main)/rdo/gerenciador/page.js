import { createClient } from '@/utils/supabase/server';
import RdoListManager from '@/components/RdoListManager';
import Link from 'next/link';

export default async function ManageRdosPage() {
  const supabase = createClient();

  // Busca todos os RDOs da sua tabela 'diarios_obra' (nome correto da tabela)
  // Inclui as informações relacionadas de empreendimentos e funcionários
  const { data: rdos, error: rdosError } = await supabase
    .from('diarios_obra') // CORRIGIDO: Nome da tabela para 'diarios_obra'
    .select(`
      *,
      empreendimentos (id, nome), // Seleciona apenas id e nome do empreendimento
      criado_por_usuario:usuarios (id, nome, sobrenome) // Assume que o campo é 'criado_por_usuario_id' e faz um join com a tabela 'usuarios'
    `)
    .order('data_relatorio', { ascending: false }); // Ordena pela data do relatório

  if (rdosError) {
    console.error('Erro ao buscar RDOs:', rdosError);
    return <p className="text-red-500 p-4">Erro ao carregar Diários de Obra: {rdosError.message}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Diários de Obra</h1>
        <Link href="/rdo" className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md shadow-sm hover:bg-gray-300">
          &larr; Voltar para Cadastro de RDO
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <RdoListManager initialRdos={rdos || []} />
      </div>
    </div>
  );
}