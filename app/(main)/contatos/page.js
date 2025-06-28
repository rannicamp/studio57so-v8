"use client";

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import ContatoList from '../../../components/ContatoList';
import ContatoImporter from '../../../components/ContatoImporter';
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faCopy, faSpinner, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

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
      return (
        <div className="text-center p-10">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
          <p className="mt-3 text-gray-600">Carregando contatos...</p>
        </div>
      )
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

        <Link href="/contatos/duplicatas" className="bg-orange-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-orange-600 flex items-center gap-2">
            <FontAwesomeIcon icon={faCopy} />
            Mesclar
        </Link>
        
        {/* NOVO BOTÃO ADICIONADO AQUI */}
        <Link href="/contatos/formatar-telefones" className="bg-purple-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-purple-600 flex items-center gap-2">
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            Padronizar
        </Link>
        
        <Link href="/contatos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Novo Contato
        </Link>

      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <ContatoList 
            initialContatos={contatos} 
            onActionComplete={getContatos}
        />
      </div>
    </div>
  );
}