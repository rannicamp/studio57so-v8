import { createClient } from '../../../utils/supabase/server'; // Caminho corrigido para o 'server' client
import EmployeeList from '../../../components/EmployeeList';
import Link from 'next/link';

export default async function GerenciamentoFuncionariosPage() {
  const supabase = createClient();

  const { data: employees, error } = await supabase
    .from('funcionarios')
    .select(`
      *,
      cadastro_empresa ( razao_social ),
      empreendimentos ( id, nome ),
      documentos_funcionarios ( id, nome_documento, caminho_arquivo ) // Inclui os documentos
    `)
    .order('full_name');

  if (error) {
    console.error('Erro ao buscar funcionários:', error);
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Funcionários</h1>
        <Link href="/funcionarios/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Novo Funcionário
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <EmployeeList initialEmployees={employees || []} />
      </div>
    </div>
  );
}