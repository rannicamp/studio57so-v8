"use client";

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import ContatoList from '../../../components/ContatoList';
import ContatoImporter from '../../../components/ContatoImporter';
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport } from '@fortawesome/free-solid-svg-icons';

export default function GerenciamentoContatosPage() {
  const { setPageTitle } = useLayout();
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const supabase = createClient();

  const getContatos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contatos')
      .select('*, telefones ( id, telefone ), emails ( id, email )')
      .order('nome');

    if (error) {
      console.error("Erro ao buscar contatos:", error);
    } else {
      setContatos(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    setPageTitle('Gerenciamento de Contatos');
    getContatos();
  }, [setPageTitle, getContatos]);

  if (loading) {
      return <p className="text-center p-10">Carregando contatos...</p>
  }

  return (
    <div className="space-y-6">
      <ContatoImporter 
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportComplete={getContatos}
      />
       <div className="flex justify-end items-center gap-4">
        <button 
          onClick={() => setIsImporterOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faFileImport} />
          Importar CSV
        </button>
        <Link href="/contatos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Novo Contato
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <ContatoList initialContatos={contatos} />
      </div>
    </div>
  );
}