import { createClient } from '../../../../utils/supabase/server';
import RdoForm from '../../../../components/RdoForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function RdoEditPage({ params }) {
  const supabase = createClient();
  const { id } = params;

  // Busca o RDO específico pelo ID, junto com todos os seus dados relacionados
  const { data: rdo, error } = await supabase
    .from('diarios_obra')
    .select(`
      *,
      empreendimentos(*),
      ocorrencias(*),
      rdo_fotos_uploads(*)
    `)
    .eq('id', id)
    .single();

  if (error || !rdo) {
    console.error("RDO não encontrado:", error);
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/rdo/gerenciador" className="text-blue-500 hover:underline mb-4 inline-block">
          &larr; Voltar para o Gerenciador de RDOs
      </Link>
      
      {/* O formulário agora é renderizado com todos os dados do RDO selecionado */}
      <RdoForm initialRdoData={rdo} />
    </div>
  );
}