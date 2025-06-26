import { createClient } from '../../../../utils/supabase/server';
import EmpreendimentoForm from '../../../../components/EmpreendimentoForm';
import Link from 'next/link';

// Esta página é um "Server Component", por isso pode ser async
export default async function CadastroEmpreendimentoPage() {
  const supabase = createClient();

  // Busca apenas o ID e a Razão Social das empresas para popular o dropdown
  const { data: companies } = await supabase
    .from('cadastro_empresa')
    .select('id, razao_social')
    .order('razao_social', { ascending: true });

  return (
    <div>
        <Link href="/" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para o Dashboard
        </Link>
        {/* Esta página está correta: ela busca a lista de empresas 
          e passa para o componente <EmpreendimentoForm /> 
        */}
        <EmpreendimentoForm companies={companies || []} />
    </div>
  );
}