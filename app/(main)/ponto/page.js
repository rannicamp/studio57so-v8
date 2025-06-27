import { createClient } from '../../../utils/supabase/server';
import FolhaPonto from '../../../components/FolhaPonto';

export default async function ControlePontoPage() {
  const supabase = createClient();

  // Busca a lista de funcionários para passar para o componente da folha de ponto
  const { data: employees, error } = await supabase
    .from('funcionarios')
    .select('id, full_name') // Seleciona apenas os campos necessários para o componente
    .order('full_name');

  // Se der erro ao buscar, exibe uma mensagem
  if (error) {
    console.error('Erro ao buscar funcionários:', error.message);
    return <p className="p-4 text-red-500">Não foi possível carregar a lista de funcionários.</p>;
  }

  // Renderiza a página com o componente da folha de ponto
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Controle de Ponto</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <FolhaPonto employees={employees || []} />
      </div>
    </div>
  );
}