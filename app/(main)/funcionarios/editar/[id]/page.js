import { createClient } from '../../../../../utils/supabase/server';
import FichaFuncionario from '../../../../../components/FichaFuncionario';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function EditarFuncionarioPage({ params }) {
  const supabase = createClient();
  // O params.id já é acessível diretamente porque o Next.js lida com a resolução
  // em Server Components. O erro no console pode ser um falso positivo ou um aviso
  // sobre como ele é "resolvido" internamente, mas você já está usando corretamente.
  // De qualquer forma, não precisa de 'await' diretamente aqui para params.id.
  const employeeId = params.id;

  // Busca os dados do funcionário, da empresa, do empreendimento E dos documentos
  const { data: employee, error } = await supabase
    .from('funcionarios')
    .select(`
      *,
      cadastro_empresa (*),
      empreendimentos (*),
      documentos_funcionarios (*)
    `)
    .eq('id', employeeId)
    .single();

  if (error || !employee) {
    // Se não encontrar o funcionário, mostra a página de "não encontrado"
    notFound();
  }

  // Busca a lista de empresas e empreendimentos para os dropdowns do modo de edição
  const { data: companies } = await supabase.from('cadastro_empresa').select('id, razao_social');
  const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome');


  return (
    <div>
        <Link href="/funcionarios" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Funcionários
        </Link>
        <FichaFuncionario
          initialEmployee={employee}
          companies={companies || []}
          empreendimentos={empreendimentos || []}
        />
    </div>
  );
}