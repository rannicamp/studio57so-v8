import { createClient } from '../../../../../utils/supabase/server';
import EmpresaForm from '../../../../../components/EmpresaForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function EditarEmpresaPage({ params }) {
  const supabase = createClient();
  const { id } = params;

  // Busca os dados da empresa específica que será editada
  const { data: empresa, error } = await supabase
    .from('cadastro_empresa')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !empresa) {
    console.error("Empresa não encontrada:", error);
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Editar Empresa</h1>
      <div className="bg-white rounded-lg shadow p-6">
        {/* Passa os dados da empresa para o formulário */}
        <EmpresaForm initialData={empresa} />
      </div>
    </div>
  );
}