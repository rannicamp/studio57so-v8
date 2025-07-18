import { createClient } from '@/utils/supabase/server';
import EmpreendimentoForm from '@/components/EmpreendimentoForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function EditarEmpreendimentoPage({ params }) {
  const supabase = createClient();
  const { id } = params;

  // Busca os dados do empreendimento específico
  const { data: empreendimento, error } = await supabase
    .from('empreendimentos')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !empreendimento) {
    console.error("Empreendimento não encontrado:", error);
    notFound();
  }

  // Busca a lista de empresas (SPEs)
  const { data: companies } = await supabase
    .from('cadastro_empresa')
    .select('id, razao_social')
    .order('razao_social', { ascending: true });
    
  // Busca a lista de contatos que são empresas (têm CNPJ)
  const { data: contacts } = await supabase
    .from('contatos')
    .select('id, nome, razao_social')
    .not('cnpj', 'is', null)
    .order('razao_social');

  return (
    <div className="space-y-6">
      <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
          &larr; Voltar para a Lista de Empreendimentos
      </Link>
      <h1 className="text-3xl font-bold text-gray-900">Editar Empreendimento: {empreendimento.nome}</h1>
      
      <div className="bg-white rounded-lg shadow mt-4">
        <EmpreendimentoForm 
            initialData={empreendimento} 
            companies={companies || []} 
            contacts={contacts || []}
        />
      </div>
    </div>
  );
}