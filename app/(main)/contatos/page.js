"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import ContatoList from '../../../components/ContatoList';
import ContatoImporter from '../../../components/ContatoImporter';
import KpiCard from '../../../components/KpiCard'; // Importando o novo componente
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faCopy, faSpinner, faWandMagicSparkles, faUsers, faGlobeAmericas, faPhoneSlash } from '@fortawesome/free-solid-svg-icons';

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
      .select('*, telefones ( id, telefone, country_code ), emails ( id, email )')
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

  const kpiData = useMemo(() => {
    const total = contatos.length;
    const semTelefone = contatos.filter(c => !c.telefones || c.telefones.length === 0).length;
    const comTelefoneBrasil = contatos.filter(c => c.telefones?.some(t => t.country_code === '+55')).length;
    const comTelefoneEUA = contatos.filter(c => c.telefones?.some(t => t.country_code === '+1')).length;

    return { total, semTelefone, comTelefoneBrasil, comTelefoneEUA };
  }, [contatos]);

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

      {/* Seção de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total de Contatos" value={kpiData.total} icon={faUsers} color="blue" />
        <KpiCard title="Contatos do Brasil" value={kpiData.comTelefoneBrasil} icon={faGlobeAmericas} color="green" />
        <KpiCard title="Contatos dos EUA" value={kpiData.comTelefoneEUA} icon={faGlobeAmericas} color="yellow" />
        <KpiCard title="Contatos sem Telefone" value={kpiData.semTelefone} icon={faPhoneSlash} color="red" />
      </div>

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