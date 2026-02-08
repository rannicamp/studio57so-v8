import { createClient } from '@/utils/supabase/server'; // Ajuste o caminho se necessário (ex: ../../../../utils...)
import RdoForm from '@/components/rdo/RdoForm'; // Ajuste o caminho se necessário
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function RdoEditPage({ params }) {
  // CORREÇÃO 1: Next.js 15 exige 'await' nos params
  const { id } = await params;

  // CORREÇÃO 2: createClient é async agora, precisa de 'await'
  const supabase = await createClient();

  // CORREÇÃO 3: Buscamos o usuário logado para passar para o formulário
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // Busca o RDO específico pelo ID
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
      <Link 
        href="/rdo/gerenciador" 
        className="text-blue-500 hover:underline mb-4 inline-block print:hidden"
      >
          &larr; Voltar para o Gerenciador de RDOs
      </Link>
      
      {/* CORREÇÃO 4: Passamos o 'user' (que contém o ID e dados) para o RdoForm.
         O RdoForm deverá repassar isso para o RdoAutoGenerator.
      */}
      <RdoForm initialRdoData={rdo} currentUser={user} />
    </div>
  );
}