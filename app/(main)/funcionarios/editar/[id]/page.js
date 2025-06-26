import { createClient } from '../../../../../utils/supabase/server';
import FuncionarioForm from '../../../../../components/FuncionarioForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function EditarFuncionarioPage({ params }) {
  const supabase = createClient();
  const employeeId = params.id;

  // Busca os dados do funcionário que será editado
  const { data: employee, error } = await supabase
    .from('funcionarios')
    .select('*')
    .eq('id', employeeId)
    .single();

  // Se não encontrar o funcionário, mostra a página de erro 404
  if (error || !employee) {
    notFound();
  }

  // Busca as listas de empresas e empreendimentos para os menus de seleção
  const { data: companies } = await supabase.from('cadastro_empresa').select('id, razao_social');
  const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome');

  return (
    <div>
      <Link href="/funcionarios" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para a Lista de Funcionários
      </Link>
      
      {/* Aqui está a mágica: em vez de chamar a FichaFuncionario,
        chamamos o FuncionarioForm, passando os dados do funcionário.
      */}
      <FuncionarioForm
        initialData={employee}
        companies={companies || []}
        empreendimentos={empreendimentos || []}
      />
    </div>
  );
}