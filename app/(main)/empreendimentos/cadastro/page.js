'use client';

import { createClient } from '../../../../utils/supabase/client';
import EmpreendimentoForm from '../../../../components/EmpreendimentoForm';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CadastroEmpreendimentoPage() {
  const supabase = createClient();
  const [corporateEntities, setCorporateEntities] = useState([]);
  const [proprietariaOptions, setProprietariaOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: entitiesData } = await supabase.rpc('get_corporate_entities');
      setCorporateEntities(entitiesData || []);

      const { data: proprietariaData } = await supabase.from('cadastro_empresa').select('id, razao_social');
      setProprietariaOptions(proprietariaData || []);

      setLoading(false);
    }
    loadData();
  }, [supabase]);


  if (loading) {
    return <p>Carregando dados do formulário...</p>;
  }

  return (
    <div className="space-y-6">
       <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Empreendimentos
        </Link>
      <div className="bg-white rounded-lg shadow p-6">
        <EmpreendimentoForm
            corporateEntities={corporateEntities}
            proprietariaOptions={proprietariaOptions}
        />
      </div>
    </div>
  );
}