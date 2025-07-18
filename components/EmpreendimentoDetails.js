'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faRulerCombined, faBoxOpen, faFileLines } from '@fortawesome/free-solid-svg-icons'; // Adicionado faFileLines para documentos

// Componente auxiliar para exibir campos de informação, inspirado na ficha do funcionário
function InfoField({ label, value, fullWidth = false }) {
  if (value === null || value === undefined || value === '') { // Tratamento para campos vazios ou nulos
    return null; // Não exibe o campo se não houver valor
  }
  return (
    <div className={fullWidth ? "md:col-span-3" : ""}> {/* Ajustado para 3 colunas */}
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

export default function EmpreendimentoDetails({ empreendimento, corporateEntities = [], proprietariaOptions = [], empreendimentoAnexos = [], quadroDeAreas = [] }) {
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
  // Ajustado para usar os campos corretos da tabela 'contatos' que são 'nome' ou 'razao_social'
  const incorporadora = corporateEntities.find(e => e.id === empreendimento.incorporadora_id);
  const construtora = corporateEntities.find(e => e.id === empreendimento.construtora_id);
  const proprietaria = proprietariaOptions.find(p => p.id === empreendimento.empresa_proprietaria_id);


  // Formatação de valores
  const formattedValorTotal = empreendimento.valor_total
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(empreendimento.valor_total))
    : 'N/A';
  const formattedTerrenoAreaTotal = empreendimento.terreno_area_total ? `${empreendimento.terreno_area_total} m²` : 'N/A';

  // Funções auxiliares para filtrar anexos por tipo
  const getAnexosBySigla = (siglas) => {
    if (!empreendimentoAnexos || !Array.isArray(empreendimentoAnexos)) return [];
    return empreendimentoAnexos.filter(anexo =>
      anexo.tipo && anexo.tipo.sigla && siglas.includes(anexo.tipo.sigla.toUpperCase()) // Adicionada verificação anexo.tipo.sigla
    );
  };

  const fotosImagens = getAnexosBySigla(['FOTOS', 'IMAGEM']);
  const documentosGerais = getAnexosBySigla(['GENERAL', 'PROJETO', 'RRT', 'CNO', 'ART', 'ALVARA', 'HABITE-SE', 'AVCB', 'LAUDO', 'CERTIDAO']); // Exemplo de siglas para documentos gerais
  const documentosJuridicos = getAnexosBySigla(['JURIDICAL', 'MINUTA', 'CONTRATO', 'REGISTRO', 'ESCRITURA', 'MATRICULA']); // Exemplo de siglas para documentos jurídicos


  return (
    <div className="p-6 bg-white shadow-md rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">{empreendimento.nome}</h1> {/* Usando 'nome' */}
        <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
          Editar Empreendimento
        </Link>
      </div>

      {/* Seção de KPIs (inspirado no Gerenciamento de Funcionários) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard title="Status Atual" value={empreendimento.status || 'N/A'} icon={faBuilding} />
        <KpiCard title="Valor Total" value={formattedValorTotal} icon={faRulerCombined} />
        <KpiCard title="Área Total do Terreno" value={formattedTerrenoAreaTotal} icon={faBoxOpen} />
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
              ${activeTab === 'documentos_juridicos' ? 'border-b-2 border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
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
              <InfoField label="Nome Fantasia" value={empreendimento.nome} />
              <InfoField label="Nome Oficial (Cartório)" value={empreendimento.nome_empreendimento || 'N/A'} />
              <InfoField label="Status" value={empreendimento.status} />
              <InfoField label="Empresa Proprietária" value={proprietaria ? (proprietaria.nome_fantasia || proprietaria.razao_social) : 'N/A'} />
              {/* O nome ou razão social do contato é mais apropriado que display_name aqui */}
              <InfoField label="Incorporadora" value={incorporadora ? `${incorporadora.nome || incorporadora.razao_social} (${incorporadora.cnpj})` : 'N/A'} />
              <InfoField label="Construtora" value={construtora ? `${construtora.nome || construtora.razao_social} (${construtora.cnpj})` : 'N/A'} />
              <InfoField label="Data de Início" value={empreendimento.data_inicio || 'N/A'} />
              <InfoField label="Data Fim Prevista" value={empreendimento.data_fim_prevista || 'N/A'} />
              <InfoField label="Prazo de Entrega" value={empreendimento.prazo_entrega || 'N/A'} />
              <InfoField label="Valor Total" value={formattedValorTotal} />
              <InfoField label="Número da Matrícula" value={empreendimento.matricula_numero || 'N/A'} />
              <InfoField label="Cartório da Matrícula" value={empreendimento.matricula_cartorio || 'N/A'} />
              <InfoField label="Índice de Reajuste" value={empreendimento.indice_reajuste || 'N/A'} />
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <InfoField label="CEP" value={empreendimento.cep || 'N/A'} />
              <InfoField label="Rua" value={empreendimento.address_street || 'N/A'} />
              <InfoField label="Número" value={empreendimento.address_number || 'N/A'} />
              <InfoField label="Complemento" value={empreendimento.address_complement || 'N/A'} />
              <InfoField label="Bairro" value={empreendimento.neighborhood || 'N/A'} />
              <InfoField label="Cidade" value={empreendimento.city || 'N/A'} />
              <InfoField label="Estado" value={empreendimento.state || 'N/A'} />
              {/* REMOVIDO: InfoField para 'country' */}
            </div>
            
            <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Dados Contratuais Adicionais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="Dados do Contrato" value={empreendimento.dados_contrato || 'N/A'} fullWidth={true}/>
            </div>
          </div>
        )}

        {activeTab === 'caracteristicas' && (
          <div className="p-4 bg-gray-50 rounded-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Características do Imóvel</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <InfoField label="Área Total do Terreno" value={formattedTerrenoAreaTotal} />
              <InfoField label="Tipo de Estrutura" value={empreendimento.estrutura_tipo || 'N/A'} />
              <InfoField label="Tipo de Alvenaria" value={empreendimento.alvenaria_tipo || 'N/A'} />
              <InfoField label="Detalhes da Cobertura" value={empreendimento.cobertura_detalhes || 'N/A'} />
              {/* Exibindo JSONB de acabamentos */}
              <div className="md:col-span-3">
                <InfoField label="Acabamentos" value={empreendimento.acabamentos ? JSON.stringify(empreendimento.acabamentos, null, 2) : 'N/A'} fullWidth={true}/>
              </div>
              {/* Exibindo JSONB de unidades */}
              <div className="md:col-span-3">
                <InfoField label="Unidades" value={empreendimento.unidades ? JSON.stringify(empreendimento.unidades, null, 2) : 'N/A'} fullWidth={true}/>
              </div>
            </div>
            
            {/* Seção Quadro de Áreas */}
            {quadroDeAreas && quadroDeAreas.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Quadro de Áreas por Pavimento</h3>
                <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Pavimento</th>
                      <th className="py-2 px-4 text-right text-sm font-semibold text-gray-700">Área (m²)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quadroDeAreas.map((item, index) => (
                      <tr key={item.id || index} className="border-t border-gray-200">
                        <td className="py-2 px-4 text-sm">{item.pavimento_nome}</td>
                        <td className="py-2 px-4 text-right text-sm">{item.area_m2} m²</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold">
                      <td className="py-2 px-4 text-left text-sm">Total</td>
                      <td className="py-2 px-4 text-right text-sm">
                        {quadroDeAreas.reduce((sum, item) => sum + parseFloat(item.area_m2 || 0), 0).toFixed(2)} m²
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'produtos' && (
          <div className="p-4 bg-gray-50 rounded-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Produtos do Empreendimento</h2>
            {/* Link para a página de produtos atual */}
            <Link href={`/empreendimentos/${empreendimento.id}/produtos`} className="text-blue-500 hover:underline">
              Ir para a página de Produtos e Tabela de Vendas
            </Link>
            <p className="text-gray-600 mt-2">Aqui você verá a lista detalhada de produtos/unidades associados a este empreendimento.</p>
          </div>
        )}

        {activeTab === 'documentos_juridicos' && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Documentos Jurídicos</h2>
            {documentosJuridicos.length > 0 ? (
              <ul className="space-y-2">
                {documentosJuridicos.map(anexo => (
                  <li key={anexo.id} className="flex items-center gap-2 text-gray-700">
                    <FontAwesomeIcon icon={faFileLines} />
                    <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {anexo.nome_arquivo} ({anexo.descricao || anexo.tipo?.descricao})
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600">Nenhum documento jurídico cadastrado.</p>
            )}
          </div>
        )}

        {activeTab === 'documentos_gerais' && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Documentos Gerais</h2>
            {documentosGerais.length > 0 ? (
              <ul className="space-y-2">
                {documentosGerais.map(anexo => (
                  <li key={anexo.id} className="flex items-center gap-2 text-gray-700">
                    <FontAwesomeIcon icon={faFileLines} />
                    <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {anexo.nome_arquivo} ({anexo.descricao || anexo.tipo?.descricao})
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600">Nenhum documento geral cadastrado.</p>
            )}
          </div>
        )}

        {activeTab === 'fotos_imagens' && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Fotos/Imagens</h2>
            {fotosImagens.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {fotosImagens.map(anexo => (
                  <div key={anexo.id} className="relative group rounded-md overflow-hidden shadow-sm">
                    <img src={anexo.public_url} alt={anexo.nome_arquivo || 'Imagem do Empreendimento'} className="w-full h-48 object-cover"/>
                    {anexo.descricao && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                        {anexo.descricao}
                      </div>
                    )}
                  </div>
                ))}
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