import { createClient } from '../../../../utils/supabase/server';
import FuncionarioForm from '../../../../components/FuncionarioForm';
import Link from 'next/link';

export default async function CadastroFuncionarioPage() {
  const supabase = createClient();

  // Busca a lista de empresas
  const { data: companies } = await supabase
    .from('cadastro_empresa')
    .select('id, razao_social')
    .order('razao_social', { ascending: true });

  // Busca a lista de empreendimentos
  const { data: empreendimentos } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .order('nome', { ascending: true });

  return (
    <div>
        {/* Este link volta para a PÁGINA DE LISTA */}
        <Link href="/funcionarios" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Funcionários
        </Link>
        
        {/* Renderiza o formulário de cadastro */}
        <FuncionarioForm companies={companies} empreendimentos={empreendimentos} />
    </div>
  );
}