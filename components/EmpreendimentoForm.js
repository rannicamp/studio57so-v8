'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function EmpreendimentoForm({ empreendimento, corporateEntities = [], proprietariaOptions = [], documentoTipos = [] }) {
  const [formData, setFormData] = useState({
    nome: '', // Nome fantasia/principal
    nome_empreendimento: '', // Nome oficial/cartório
    status: 'Em Andamento', // Valor padrão do BD
    address_zip_code: '', // Corresponde a 'cep' no BD
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'Brasil', // Valor padrão, se aplicável - REMOVIDO NO SUBMIT
    terreno_area_total: '', // Renomeado de total_area no código
    // valor_total: '', // Removido
    data_inicio: '',
    data_fim_prevista: '', // Renomeado de dataPrevisaoConclusao no código
    prazo_entrega: '', // Renomeado de delivery_date no código
    incorporadora_id: null,
    construtora_id: null,
    empresa_proprietaria_id: null, // Renomeado de company_proprietaria_id no código
    matricula_numero: '',
    matricula_cartorio: '',
    estrutura_tipo: '',
    alvenaria_tipo: '',
    cobertura_detalhes: '',
    acabamentos: null, // JSONB
    unidades: null, // JSONB
    // indice_reajuste: '', // Removido
    // dados_contrato: '', // Removido
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('fotos'); // 'fotos', 'documentos_gerais', 'documentos_juridicos'

  const router = useRouter();
  const supabase = createClient();

  // Refs para os inputs de arquivo (para limpar o valor após o upload)
  const fileInputRefs = useRef({});

  // Mapeamento dos tipos de documento para IDs (assumindo que você terá esses IDs no BD)
  const getDocumentoTipoId = (sigla) => {
    const tipo = documentoTipos.find(dt => dt.sigla === sigla);
    return tipo ? tipo.id : null;
  };

  useEffect(() => {
    if (empreendimento) {
      setFormData({
        nome: empreendimento.nome || '',
        nome_empreendimento: empreendimento.nome_empreendimento || '',
        status: empreendimento.status || 'Em Andamento',
        address_zip_code: empreendimento.cep || '', // Mapeando cep do BD para address_zip_code no form
        address_street: empreendimento.address_street || '',
        address_number: empreendimento.address_number || '',
        address_complement: empreendimento.address_complement || '',
        neighborhood: empreendimento.neighborhood || '',
        city: empreendimento.city || '',
        state: empreendimento.state || '',
        country: empreendimento.country || 'Brasil',
        terreno_area_total: empreendimento.terreno_area_total || '',
        // valor_total: empreendimento.valor_total || '', // Removido
        data_inicio: empreendimento.data_inicio || '',
        data_fim_prevista: empreendimento.data_fim_prevista || '',
        prazo_entrega: empreendimento.prazo_entrega || '',
        incorporadora_id: empreendimento.incorporadora_id || null,
        construtora_id: empreendimento.construtora_id || null,
        empresa_proprietaria_id: empreendimento.empresa_proprietaria_id || null,
        matricula_numero: empreendimento.matricula_numero || '',
        matricula_cartorio: empreendimento.matricula_cartorio || '',
        estrutura_tipo: empreendimento.estrutura_tipo || '',
        alvenaria_tipo: empreendimento.alvenaria_tipo || '',
        cobertura_detalhes: empreendimento.cobertura_detalhes || '',
        acabamentos: empreendimento.acabamentos || null,
        unidades: empreendimento.unidades || null,
        // indice_reajuste: empreendimento.indice_reajuste || '', // Removido
        // dados_contrato: empreendimento.dados_contrato || '', // Removido
      });
    }
  }, [empreendimento]);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCepBlur = useCallback(async (e) => {
    const cep = e.target.value?.replace(/\D/g, '');
    if (cep?.length !== 8) return;

    setMessage('Buscando CEP...');
    setIsApiLoading(true);
    try {
      const response = await fetch(`/api/cep?cep=${cep}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao buscar CEP.');
      }
      const data = await response.json();

      setFormData((prev) => ({
        ...prev,
        address_street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      }));
      toast.success('Endereço preenchido automaticamente!');
    } catch (error) {
      toast.error(`Erro ao buscar CEP: ${error.message}`);
    } finally {
      setIsApiLoading(false);
      setMessage('');
    }
  }, []);

  const handleCompanySelection = (type, selectedId) => {
    const selectedEntity = corporateEntities.find(entity => entity.id === selectedId);

    if (type === 'incorporadora') {
      setFormData(prev => ({
        ...prev,
        incorporadora_id: selectedEntity ? selectedEntity.id : null,
      }));
    } else if (type === 'construtora') {
      setFormData(prev => ({
        ...prev,
        construtora_id: selectedEntity ? selectedEntity.id : null,
      }));
    } else if (type === 'proprietaria') {
        const selectedProprietaria = proprietariaOptions.find(opt => opt.id === selectedId);
        setFormData(prev => ({
            ...prev,
            empresa_proprietaria_id: selectedProprietaria ? selectedProprietaria.id : null,
        }));
    }
  };

  const handleFileUpload = useCallback(async (event, tipoDocumentoSigla) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const filePath = `public/${empreendimento?.id || 'novo'}/${tipoDocumentoSigla}/${file.name}_${Date.now()}`;
    const { data, error: uploadError } = await supabase.storage
      .from('empreendimentos-documentos') // Usando o novo bucket
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      toast.error(`Erro ao fazer upload do arquivo: ${uploadError.message}`);
    } else {
      const { data: { publicUrl } } = supabase.storage.from('empreendimentos-documentos').getPublicUrl(data.path);

      const tipo_documento_id = getDocumentoTipoId(tipoDocumentoSigla);
      if (!tipo_documento_id) {
        toast.error(`Tipo de documento '${tipoDocumentoSigla}' não encontrado. Por favor, cadastre-o em Configurações > Tipos de Documento.`);
        setLoading(false);
        return;
      }

      // Inserir registro na tabela empreendimento_anexos
      const { error: insertError } = await supabase
        .from('empreendimento_anexos')
        .insert({
          empreendimento_id: empreendimento.id, // Assumimos que o empreendimento já existe para upload de anexos
          tipo_documento_id: tipo_documento_id,
          caminho_arquivo: data.path, // Salva o caminho interno do storage
          nome_arquivo: file.name,
          public_url: publicUrl, // Salva a URL pública para fácil acesso
        });

      if (insertError) {
        toast.error(`Erro ao registrar anexo no banco de dados: ${insertError.message}`);
        // Se der erro no insert, tentar remover o arquivo do storage para evitar lixo
        await supabase.storage.from('empreendimentos-documentos').remove([data.path]);
      } else {
        toast.success('Arquivo enviado e registrado com sucesso!');
        router.refresh(); // Atualiza a página para mostrar o novo anexo
      }
    }
    setLoading(false);
    if (fileInputRefs.current[tipoDocumentoSigla]) {
      fileInputRefs.current[tipoDocumentoSigla].value = null; // Limpa o input file
    }
  }, [supabase, empreendimento, router, documentoTipos]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Mapeia os campos do formData para os nomes do BD
    const dataToSubmit = {
        nome: formData.nome,
        nome_empreendimento: formData.nome_empreendimento,
        status: formData.status,
        cep: formData.address_zip_code, // Mapeando address_zip_code do form para cep do BD
        address_street: formData.address_street,
        address_number: formData.address_number,
        address_complement: formData.address_complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        // REMOVIDO: country: formData.country, // Esta coluna não existe no BD
        terreno_area_total: formData.terreno_area_total,
        // valor_total: formData.valor_total, // Removido
        data_inicio: formData.data_inicio,
        data_fim_prevista: formData.data_fim_prevista,
        prazo_entrega: formData.prazo_entrega,
        incorporadora_id: formData.incorporadora_id,
        construtora_id: formData.construtora_id,
        empresa_proprietaria_id: formData.empresa_proprietaria_id,
        matricula_numero: formData.matricula_numero,
        matricula_cartorio: formData.matricula_cartorio,
        estrutura_tipo: formData.estrutura_tipo,
        alvenaria_tipo: formData.alvenaria_tipo,
        cobertura_detalhes: formData.cobertura_detalhes,
        acabamentos: formData.acabamentos,
        unidades: formData.unidades,
        // indice_reajuste: formData.indice_reajuste, // Removido
        // dados_contrato: formData.dados_contrato, // Removido
    };

    let errorResult = null;

    if (empreendimento) {
      // Atualizar empreendimento existente
      const { error } = await supabase
        .from('empreendimentos')
        .update(dataToSubmit)
        .eq('id', empreendimento.id);
      errorResult = error;
    } else {
      // Inserir novo empreendimento
      const { data, error } = await supabase.from('empreendimentos').insert(dataToSubmit).select().single();
      errorResult = error;
      if (data) {
        // Se for um novo cadastro, redireciona para a página de edição/visualização com o ID
        toast.success('Empreendimento cadastrado com sucesso!');
        router.push(`/empreendimentos/editar/${data.id}`);
        router.refresh();
        setLoading(false);
        return; // Sai da função para evitar o redirecionamento duplicado
      }
    }

    if (errorResult) {
      console.error('Erro ao salvar empreendimento:', errorResult.message);
      setMessage(`Erro ao salvar o empreendimento: ${errorResult.message}`);
      toast.error('Erro ao salvar o empreendimento.', {
        description: errorResult.message,
      });
    } else {
      toast.success('Empreendimento atualizado com sucesso!');
      router.push('/empreendimentos'); // Redireciona para a lista após atualização
      router.refresh();
    }
    setLoading(false);
  };

  const renderFileUploadContent = () => {
    // Note: Para exibir arquivos já existentes, você precisaria buscar da tabela empreendimento_anexos
    // e passá-los para este componente, ou buscar aqui dentro.
    // Para simplificar agora, estamos focando apenas no upload.
    return (
      <div className="mt-4">
        <label htmlFor={`file-upload-${activeTab}`} className="block text-sm font-medium text-gray-700 mb-2">
          Selecione o arquivo para {activeTab === 'fotos' ? 'Fotos/Imagens' : activeTab === 'documentos_gerais' ? 'Documentos Gerais' : 'Documentos Jurídicos'}
        </label>
        <input
          type="file"
          id={`file-upload-${activeTab}`}
          ref={el => fileInputRefs.current[activeTab] = el}
          accept={activeTab === 'fotos' ? 'image/*' : '.pdf,.doc,.docx'}
          onChange={(e) => handleFileUpload(e, activeTab)}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
          disabled={!empreendimento} // Desabilita upload se não estiver no modo de edição (empreendimento existente)
        />
        {!empreendimento && (
          <p className="text-sm text-red-500 mt-2">Você precisa salvar o empreendimento antes de fazer uploads de arquivos.</p>
        )}
      </div>
    );
  };


  return (
    <div className="p-6 bg-white shadow-md rounded-lg space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        {empreendimento ? 'Editar Empreendimento' : 'Cadastrar Novo Empreendimento'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div className={`p-3 rounded-md ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Seção DADOS GERAIS */}
        <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-4">Dados Gerais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">Nome (Fantasia)</label>
            <input
              type="text"
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="nome_empreendimento" className="block text-sm font-medium text-gray-700 mb-1">Nome Oficial (Cartório)</label>
            <input
              type="text"
              id="nome_empreendimento"
              name="nome_empreendimento"
              value={formData.nome_empreendimento}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Em Andamento">Em Andamento</option>
              <option value="Planejamento">Planejamento</option>
              <option value="Concluído">Concluído</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div>
            <label htmlFor="data_inicio" className="block text-sm font-medium text-gray-700 mb-1">Data de Início</label>
            <input
              type="date"
              id="data_inicio"
              name="data_inicio"
              value={formData.data_inicio}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="data_fim_prevista" className="block text-sm font-medium text-gray-700 mb-1">Data Fim Prevista</label>
            <input
              type="date"
              id="data_fim_prevista"
              name="data_fim_prevista"
              value={formData.data_fim_prevista}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="prazo_entrega" className="block text-sm font-medium text-gray-700 mb-1">Prazo de Entrega</label>
            <input
              type="text"
              id="prazo_entrega"
              name="prazo_entrega"
              value={formData.prazo_entrega}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: 24 meses após o lançamento"
            />
          </div>
          {/* Campo Valor Total removido */}
          {/* Campo Índice de Reajuste removido */}
          <div>
            <label htmlFor="terreno_area_total" className="block text-sm font-medium text-gray-700 mb-1">Área Total do Terreno (m²)</label>
            <input
              type="text"
              id="terreno_area_total"
              name="terreno_area_total"
              value={formData.terreno_area_total}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: 1200.50"
            />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-4">Informações de Endereço</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="address_zip_code" className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
            <div className="relative">
              <input
                type="text"
                id="address_zip_code"
                name="address_zip_code"
                value={formData.address_zip_code}
                onChange={handleChange}
                onBlur={handleCepBlur}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-10 focus:ring-blue-500 focus:border-blue-500"
              />
              {isApiLoading && (
                <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500" />
              )}
            </div>
            {isApiLoading && <p className="text-sm text-gray-500 mt-1">Buscando CEP...</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="address_street" className="block text-sm font-medium text-gray-700 mb-1">Rua</label>
            <input
              type="text"
              id="address_street"
              name="address_street"
              value={formData.address_street}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="address_number" className="block text-sm font-medium text-gray-700 mb-1">Número</label>
            <input
              type="text"
              id="address_number"
              name="address_number"
              value={formData.address_number}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="address_complement" className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
            <input
              type="text"
              id="address_complement"
              name="address_complement"
              value={formData.address_complement}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
            <input
              type="text"
              id="neighborhood"
              name="neighborhood"
              value={formData.neighborhood}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <input
              type="text"
              id="state"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">País</label>
            <input
              type="text"
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-4">Parceiros e Proprietário</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="incorporadora_id" className="block text-sm font-medium text-gray-700 mb-1">Incorporadora</label>
            <select
              id="incorporadora_id"
              name="incorporadora_id"
              value={formData.incorporadora_id || ''}
              onChange={(e) => handleCompanySelection('incorporadora', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Nenhum</option>
              {corporateEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.display_name} ({entity.cnpj})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="construtora_id" className="block text-sm font-medium text-gray-700 mb-1">Construtora</label>
            <select
              id="construtora_id"
              name="construtora_id"
              value={formData.construtora_id || ''}
              onChange={(e) => handleCompanySelection('construtora', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Nenhum</option>
              {corporateEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.display_name} ({entity.cnpj})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="empresa_proprietaria_id" className="block text-sm font-medium text-gray-700 mb-1">Empresa Proprietária</label>
            <select
              id="empresa_proprietaria_id"
              name="empresa_proprietaria_id"
              value={formData.empresa_proprietaria_id || ''}
              onChange={(e) => handleCompanySelection('proprietaria', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Nenhum</option>
              {proprietariaOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.nome_fantasia || company.razao_social}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Seção Detalhes do Registro e Construção */}
        <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-4">Detalhes do Registro e Construção</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="matricula_numero" className="block text-sm font-medium text-gray-700 mb-1">Número da Matrícula</label>
            <input
              type="text"
              id="matricula_numero"
              name="matricula_numero"
              value={formData.matricula_numero}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="matricula_cartorio" className="block text-sm font-medium text-gray-700 mb-1">Cartório da Matrícula</label>
            <input
              type="text"
              id="matricula_cartorio"
              name="matricula_cartorio"
              value={formData.matricula_cartorio}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="estrutura_tipo" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Estrutura</label>
            <input
              type="text"
              id="estrutura_tipo"
              name="estrutura_tipo"
              value={formData.estrutura_tipo}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="alvenaria_tipo" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Alvenaria</label>
            <input
              type="text"
              id="alvenaria_tipo"
              name="alvenaria_tipo"
              value={formData.alvenaria_tipo}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="cobertura_detalhes" className="block text-sm font-medium text-gray-700 mb-1">Detalhes da Cobertura</label>
            <input
              type="text"
              id="cobertura_detalhes"
              name="cobertura_detalhes"
              value={formData.cobertura_detalhes}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Campo Dados do Contrato removido */}
          {/* Campos JSONB - Acabamentos e Unidades - podem ser tratados com um TextArea para JSON ou um componente mais complexo */}
          <div>
            <label htmlFor="acabamentos" className="block text-sm font-medium text-gray-700 mb-1">Acabamentos (JSON)</label>
            <textarea
              id="acabamentos"
              name="acabamentos"
              value={formData.acabamentos ? JSON.stringify(formData.acabamentos, null, 2) : ''}
              onChange={(e) => {
                try {
                  setFormData(prev => ({ ...prev, acabamentos: JSON.parse(e.target.value) }));
                } catch (error) {
                  // Lidar com JSON inválido, talvez mostrar um erro
                  setFormData(prev => ({ ...prev, acabamentos: e.target.value })); // Salva como string até ser JSON válido
                }
              }}
              rows="5"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
              placeholder='Ex: {"piso": "porcelanato", "parede": "pintura"}'
            ></textarea>
          </div>
          <div>
            <label htmlFor="unidades" className="block text-sm font-medium text-gray-700 mb-1">Unidades (JSON)</label>
            <textarea
              id="unidades"
              name="unidades"
              value={formData.unidades ? JSON.stringify(formData.unidades, null, 2) : ''}
              onChange={(e) => {
                try {
                  setFormData(prev => ({ ...prev, unidades: JSON.parse(e.target.value) }));
                } catch (error) {
                  // Lidar com JSON inválido
                  setFormData(prev => ({ ...prev, unidades: e.target.value })); // Salva como string
                }
              }}
              rows="5"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
              placeholder='Ex: [{"numero": "101", "tipo": "apartamento"}]'
            ></textarea>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-4">Upload de Arquivos</h2>
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'fotos' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('fotos')}
          >
            Fotos/Imagens
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'documentos_gerais' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('documentos_gerais')}
          >
            Documentos Gerais
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${activeTab === 'documentos_juridicos' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('documentos_juridicos')}
          >
            Documentos Jurídicos
          </button>
        </div>
        {renderFileUploadContent()}

        <button
          type="submit"
          className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              Processando...
            </>
          ) : (
            empreendimento ? 'Atualizar Empreendimento' : 'Cadastrar Empreendimento'
          )}
        </button>
      </form>
    </div>
  );
}