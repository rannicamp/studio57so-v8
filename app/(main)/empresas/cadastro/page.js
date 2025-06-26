import { createClient } from '../../../../utils/supabase/server';
import EmpresaForm from '../../../../components/EmpresaForm';
import Link from 'next/link';

export default async function CadastroEmpresaPage() {
  const supabase = createClient();

  // Busca a lista de empresas para o formulário
  const { data: companies } = await supabase
    .from('cadastro_empresa')
    .select('id, razao_social')
    .order('razao_social', { ascending: true });

  // Busca a lista de empreendimentos para o formulário
  const { data: empreendimentos } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .order('nome', { ascending: true });

  return (
    <div className="space-y-6">
       <Link href="/empresas" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Empresas
        </Link>
      <h1 className="text-3xl font-bold text-gray-900">Cadastro de Nova Empresa</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <EmpresaForm companies={companies || []} empreendimentos={empreendimentos || []} />
      </div>
    </div>
  );
}