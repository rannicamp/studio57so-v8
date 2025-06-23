import { createClient } from '../../../utils/supabase/server';
import EmpreendimentoForm from '../../../components/EmpreendimentoForm'; // Importa nosso formulário
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
        {/* Renderiza o formulário, passando a lista de empresas para ele */}
        <EmpreendimentoForm companies={companies} />
    </div>
  );
}