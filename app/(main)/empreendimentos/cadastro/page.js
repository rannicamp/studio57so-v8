import { createClient } from '../../../../utils/supabase/server';
import EmpreendimentoForm from '../../../../components/EmpreendimentoForm';
import Link from 'next/link';

export default async function CadastroEmpreendimentoPage() {
  const supabase = createClient();

  // Busca a lista de empresas (SPEs) para o dropdown de proprietária
  const { data: companies } = await supabase
    .from('cadastro_empresa')
    .select('id, razao_social')
    .order('razao_social', { ascending: true });

  // Busca a lista de contatos que são empresas (têm CNPJ) para os dropdowns de Incorporadora/Construtora
  const { data: contacts } = await supabase
    .from('contatos')
    .select('id, nome, razao_social')
    .not('cnpj', 'is', null) // Filtra apenas contatos que têm CNPJ
    .order('razao_social');

  return (
    <div className="space-y-6">
        <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Empreendimentos
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Cadastrar Novo Empreendimento</h1>
        
        <EmpreendimentoForm companies={companies || []} contacts={contacts || []} />
    </div>
  );
}
