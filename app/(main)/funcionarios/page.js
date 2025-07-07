import { createClient } from '../../../utils/supabase/server';
import EmployeeList from '../../../components/EmployeeList';
import Link from 'next/link';

export default async function GerenciamentoFuncionariosPage() {
  const supabase = createClient();

  const { data: employeesData, error } = await supabase
    .from('funcionarios')
    .select(`
      *,
      cadastro_empresa ( razao_social ),
      empreendimentos ( id, nome ),
      documentos_funcionarios ( id, nome_documento, caminho_arquivo )
    `)
    .order('full_name');

  if (error) {
    console.error('Erro ao buscar funcionários:', error);
  }

  // Gera links seguros e temporários para as fotos
  const employees = employeesData ? await Promise.all(
    employeesData.map(async (employee) => {
      if (employee.foto_url) {
        
        // ***** CORREÇÃO APLICADA AQUI *****
        // O sistema agora busca a foto no bucket correto 'funcionarios-documentos'
        const { data, error: urlError } = await supabase.storage
          .from('funcionarios-documentos') 
          .createSignedUrl(employee.foto_url, 3600); // URL válida por 1 hora

        if (!urlError) {
          employee.foto_url = data.signedUrl;
        } else {
            // Se der erro ao gerar a URL, define como nulo para mostrar o placeholder
            employee.foto_url = null; 
            console.error(`Erro ao gerar URL da foto para ${employee.full_name}:`, urlError.message);
        }
      }
      return employee;
    })
  ) : [];

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