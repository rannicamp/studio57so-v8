'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faRulerCombined, faBoxOpen } from '@fortawesome/free-solid-svg-icons';

// Componente auxiliar para exibir campos de informação, inspirado na ficha do funcionário
function InfoField({ label, value }) {
  if (!value && value !== 0 && value !== false) {
    return null;
  }
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}

// Componente KpiCard básico, você já tem um mais complexo, mas este serve como exemplo de estrutura.
function KpiCard({ title, value, icon, colorClass = 'text-blue-500' }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
      {icon && <FontAwesomeIcon icon={icon} className={`text-2xl ${colorClass}`} />}
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function EmpreendimentoDetails({ empreendimento, corporateEntities = [], proprietariaOptions = [] }) {
  const [activeTab, setActiveTab] = useState('dados_gerais');

  if (!empreendimento) {
    return (
      <div className="p-6 text-center text-gray-700">
        <p>Empreendimento não encontrado.</p>
        <Link href="/empreendimentos" className="text-blue-500 hover:underline mt-4 block">Voltar para a lista de Empreendimentos</Link>
      </div>
    );
  }

  // Encontrar nomes das empresas a partir dos IDs
  const incorporadora = corporateEntities.find(e => e.id === empreendimento.incorporadora_id);
  const construtora = corporateEntities.find(e => e.id === empreendimento.construtora_id);
  const proprietaria = proprietariaOptions.find(p => p.id === empreendimento.company_proprietaria_id);

  const formattedPrice = empreendimento.price
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(empreendimento.price)
    : 'N/A';
  const formattedTotalArea = empreendimento.total_area ? `${empreendimento.total_area} m²` : 'N/A';


  return (
    <div className="p-6 bg-white shadow-md rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">{empreendimento.name}</h1>
        <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
          Editar Empreendimento
        </Link>
      </div>

      {/* Seção de KPIs (inspirado no Gerenciamento de Funcionários) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard title="Status Atual" value={empreendimento.status || 'N/A'} icon={faBuilding} />
        <KpiCard title="Preço Sugerido" value={formattedPrice} icon={faRulerCombined} />
        <KpiCard title="Área Total" value={formattedTotalArea} icon={faBoxOpen} />
        {/* Adicione mais KPIs conforme necessário, como VGV, unidades vendidas, etc. */}
      </div>

      {/* Abas de Navegação */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('dados_gerais')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'dados_gerais' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Dados Gerais
          </button>
          <button
            onClick={() => setActiveTab('caracteristicas')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'caracteristicas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Características
          </button>
          <button
            onClick={() => setActiveTab('produtos')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'produtos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Produtos
          </button>
          <button
            onClick={() => setActiveTab('documentos_juridicos')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'documentos_juridicos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Documentos Jurídicos
          </button>
          <button
            onClick={() => setActiveTab('documentos_gerais')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'documentos_gerais' ? 'border-b-2 border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Documentos Gerais
          </button>
          <button
            onClick={() => setActiveTab('fotos_imagens')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'fotos_imagens' ? 'border-b-2 border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Fotos/Imagens
          </button>
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      <div>
        {activeTab === 'dados_gerais' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Dados Gerais do Empreendimento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <InfoField label="Nome do Empreendimento" value={empreendimento.name} />
              <InfoField label="Status" value={empreendimento.status} />
              <InfoField label="Empresa Proprietária" value={proprietaria ? (proprietaria.nome_fantasia || proprietaria.razao_social) : 'N/A'} />
              <InfoField label="Incorporadora" value={incorporadora ? `${incorporadora.display_name} (${incorporadora.cnpj})` : 'N/A'} />
              <InfoField label="Construtora" value={construtora ? `${construtora.display_name} (${construtora.cnpj})` : 'N/A'} />
              <InfoField label="Número CNO" value={empreendimento.cno_number || 'N/A'} />
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <InfoField label="Rua" value={empreendimento.address_street} />
              <InfoField label="Número" value={empreendimento.address_number} />
              <InfoField label="Complemento" value={empreendimento.address_complement || 'N/A'} />
              <InfoField label="Bairro" value={empreendimento.neighborhood} />
              <InfoField label="Cidade" value={empreendimento.city} />
              <InfoField label="Estado" value={empreendimento.state} />
              <InfoField label="CEP" value={empreendimento.address_zip_code} />
              <InfoField label="País" value={empreendimento.country} />
            </div>
          </div>
        )}

        {activeTab === 'caracteristicas' && (
          <div className="p-4 bg-gray-50 rounded-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Características do Imóvel</h2>
            <p className="text-gray-600">Conteúdo para a aba de Características virá aqui.</p>
          </div>
        )}

        {activeTab === 'produtos' && (
          <div className="p-4 bg-gray-50 rounded-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Produtos do Empreendimento</h2>
            <p className="text-gray-600">Conteúdo para a aba de Produtos (visualização dos produtos cadastrados) virá aqui.</p>
          </div>
        )}

        {activeTab === 'documentos_juridicos' && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Documentos Jurídicos</h2>
            {empreendimento.juridical_doc_url ? (
              <p className="text-gray-700 mb-2">
                <a href={empreendimento.juridical_doc_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  Ver Documento Jurídico
                </a>
              </p>
            ) : (
              <p className="text-gray-600">Nenhum documento jurídico cadastrado.</p>
            )}
          </div>
        )}

        {activeTab === 'documentos_gerais' && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Documentos Gerais</h2>
            {empreendimento.doc_url ? (
              <p className="text-gray-700 mb-2">
                <a href={empreendimento.doc_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  Ver Documento Geral
                </a>
              </p>
            ) : (
              <p className="text-gray-600">Nenhum documento geral cadastrado.</p>
            )}
          </div>
        )}

        {activeTab === 'fotos_imagens' && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Fotos/Imagens</h2>
            {empreendimento.photo_url ? (
              <div className="mt-4">
                <img src={empreendimento.photo_url} alt="Foto do Empreendimento" className="max-w-full h-auto mt-2 rounded-md shadow" />
              </div>
            ) : (
              <p className="text-gray-600">Nenhuma foto/imagem cadastrada.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}