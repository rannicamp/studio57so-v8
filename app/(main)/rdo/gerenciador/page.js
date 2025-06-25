import { createClient } from '../../../../utils/supabase/server';
import RdoListManager from '../../../../components/RdoListManager';
import Link from 'next/link';

export default async function ManageRdosPage() {
  const supabase = createClient();

  // Busca os RDOs e os dados relacionados para a lista e filtros
  const { data: rdos, error: rdosError } = await supabase
    .from('diarios_obra') 
    .select(`
      *,
      empreendimentos ( nome ) 
    `)
    .order('data_relatorio', { ascending: false });
    
  // Busca a lista de todos os empreendimentos para o filtro
  const { data: empreendimentos, error: empreendimentosError } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .order('nome');

  // Busca a lista de todos os responsáveis para o filtro
  const { data: responsaveis, error: responsaveisError } = await supabase
    .from('diarios_obra')
    .select('responsavel_rdo')
    .neq('responsavel_rdo', 'is', null);

  if (rdosError || empreendimentosError || responsaveisError) {
    console.error('Erro ao buscar dados para o gerenciador de RDO:', { rdosError, empreendimentosError, responsaveisError });
  }
  
  // Cria uma lista de responsáveis únicos
  const uniqueResponsaveis = [...new Set(responsaveis?.map(r => r.responsavel_rdo) || [])];

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
          responsaveisList={uniqueResponsaveis}
        />
      </div>
    </div>
  );
}