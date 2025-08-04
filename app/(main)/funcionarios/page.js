import { createClient } from '../../../utils/supabase/server';
import EmployeeList from '../../../components/EmployeeList';
import Link from 'next/link';
import { redirect } from 'next/navigation'; // Importar redirect

// Função para buscar permissões do usuário logado
async function checkPermissions() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { canView: false, canCreate: false };
  }

  const { data: userData } = await supabase
    .from('usuarios')
    .select('funcao_id, funcoes(nome_funcao)')
    .eq('id', user.id)
    .single();

  if (userData?.funcoes?.nome_funcao === 'Proprietário') {
    return { canView: true, canCreate: true };
  }

  const { data: permissions } = await supabase
    .from('permissoes')
    .select('pode_ver, pode_criar')
    .eq('funcao_id', userData.funcao_id)
    .eq('recurso', 'funcionarios')
    .single();

  return {
    canView: permissions?.pode_ver || false,
    canCreate: permissions?.pode_criar || false
  };
}


export default async function GerenciamentoFuncionariosPage() {
  const { canView, canCreate } = await checkPermissions();

  if (!canView) {
    redirect('/'); // Se não pode ver, redireciona para a página inicial
  }
  
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

  const employees = employeesData ? await Promise.all(
    employeesData.map(async (employee) => {
      if (employee.foto_url) {
        const { data, error: urlError } = await supabase.storage
          .from('funcionarios-documentos') 
          .createSignedUrl(employee.foto_url, 3600);

        if (!urlError) {
          employee.foto_url = data.signedUrl;
        } else {
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
        {/* O botão de "Novo Funcionário" só aparece se o usuário tiver permissão para criar */}
        {canCreate && (
          <Link href="/funcionarios/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
            + Novo Funcionário
          </Link>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <EmployeeList initialEmployees={employees || []} />
      </div>
    </div>
  );
}