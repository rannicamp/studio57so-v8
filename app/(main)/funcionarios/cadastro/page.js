import { createClient } from '../../../../utils/supabase/server';
import FuncionarioForm from '../../../../components/FuncionarioForm';
import Link from 'next/link';

export default async function CadastroFuncionarioPage() {
  const supabase = createClient();

  const { data: companies } = await supabase.from('cadastro_empresa').select('id, razao_social').order('razao_social');
  const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, nome').order('nome');
  const { data: jornadas } = await supabase.from('jornadas').select('*').order('nome_jornada');

  return (
    <div>
        <Link href="/funcionarios" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Funcionários
        </Link>
        
        <FuncionarioForm 
            companies={companies || []} 
            empreendimentos={empreendimentos || []}
            jornadas={jornadas || []}
        />
    </div>
  );
}