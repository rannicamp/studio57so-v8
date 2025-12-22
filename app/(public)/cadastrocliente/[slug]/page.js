// app/(public)/cadastro/[slug]/page.js
import { createClient } from '@/utils/supabase/server';
import CadastroForm from './CadastroForm'; // Vamos criar este componente
import { notFound } from 'next/navigation';

// Esta função busca os dados da organização ANTES da página carregar
async function getOrganizacao(slug) {
  const supabase = await createClient();
  const { data: organizacao, error } = await supabase
    .from('organizacoes')
    .select('id, nome, logo_url, public_form_slug')
    .eq('public_form_slug', slug)
    .single();

  if (error || !organizacao) {
    return null;
  }
  return organizacao;
}

export default async function CadastroClienteDinamicoPage({ params }) {
  const organizacao = await getOrganizacao(params.slug);

  // Se o link (slug) não corresponder a nenhuma organização, mostra página de erro 404
  if (!organizacao) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white p-8 rounded-lg shadow-md">
        
        <div className="flex justify-center mb-6">
            <img
                src={organizacao.logo_url || "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG"} 
                alt={`Logo de ${organizacao.nome}`}
                className="h-16 w-auto"
            />
        </div>
        
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Ficha Cadastral</h1>
        <p className="text-center text-gray-500 mb-6">Preencha os campos para se cadastrar em {organizacao.nome}.</p>
        
        {/* Passamos o ID da organização para o formulário */}
        <CadastroForm organizacaoId={organizacao.id} />

      </div>
    </div>
  );
}