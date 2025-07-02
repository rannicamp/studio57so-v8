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

  if (error || !employee) {
    notFound();
  }

  // Busca as listas de empresas, empreendimentos e as NOVAS jornadas
  const { data: companies } = await supabase.from('cadastro_empresa').select('id, razao_social');
  const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome');
  const { data: jornadas } = await supabase.from('jornadas').select('*').order('nome_jornada');

  return (
    <div>
      <Link href="/funcionarios" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para a Lista de Funcionários
      </Link>
      
      <FuncionarioForm
        initialData={employee}
        companies={companies || []}
        empreendimentos={empreendimentos || []}
        jornadas={jornadas || []}
      />
    </div>
  );
}