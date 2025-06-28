import { createClient } from '../../../utils/supabase/server';
import OrcamentoManager from '../../../components/OrcamentoManager'; // Importando o novo componente

export default async function OrcamentoPage() {
  const supabase = createClient();

  // Busca a lista de empreendimentos para passar ao componente
  const { data: empreendimentos, error } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .order('nome');

  if (error) {
    console.error('Erro ao buscar empreendimentos:', error);
    return <p className="p-4 text-red-500">Não foi possível carregar os empreendimentos.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Planilha Orçamentária</h1>
        <p className="text-gray-600 mt-1">Selecione um empreendimento para ver, editar ou criar um novo orçamento.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {/* Usando o novo componente e passando a lista de empreendimentos para ele */}
        <OrcamentoManager empreendimentos={empreendimentos || []} />
      </div>
    </div>
  );
}