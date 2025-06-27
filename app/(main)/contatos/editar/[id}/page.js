"use client"; // Necessário para usar o hook useEffect

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../../../utils/supabase/client';
import ContatoForm from '../../../../../components/ContatoForm';
import Link from 'next/link';
import { useLayout } from '../../../../../contexts/LayoutContext';

export default function EditarContatoPage({ params }) {
  const { setPageTitle } = useLayout();
  const { id } = params;
  const [contato, setContato] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const getContato = useCallback(async () => {
    const { data, error } = await supabase
      .from('contatos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("Contato não encontrado", error);
    } else {
      setContato(data);
      setPageTitle(`Editando Contato: ${data.nome}`); // Define o título
    }
    setLoading(false);
  }, [id, supabase, setPageTitle]);

  useEffect(() => {
    getContato();
  }, [getContato]);

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!contato) {
    return <p>Contato não encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/contatos" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para a Lista de Contatos
      </Link>
      {/* O título <h1> foi removido daqui */}
      <div className="bg-white rounded-lg shadow p-6">
        <ContatoForm initialData={contato} />
      </div>
    </div>
  );
}