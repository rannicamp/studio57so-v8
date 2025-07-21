'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import FileUploadWithAI from './FileUploadWithAI';

export default function EmpreendimentoForm({ empreendimento, corporateEntities = [], proprietariaOptions = [] }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const isEditing = Boolean(empreendimento);

  // --- INÍCIO DA ALTERAÇÃO ---
  // Estados para controlar a busca de Incorporadora e Construtora
  const [searchTerms, setSearchTerms] = useState({ incorporadora: '', construtora: '' });
  const [searchResults, setSearchResults] = useState({ incorporadora: [], construtora: [] });
  const [isSearching, setIsSearching] = useState({ incorporadora: false, construtora: false });
  // --- FIM DA ALTERAÇÃO ---

  useEffect(() => {
    const initialState = {
      nome: empreendimento?.nome || '',
      nome_empreendimento: empreendimento?.nome_empreendimento || '',
      status: empreendimento?.status || 'Em Planejamento',
      cep: empreendimento?.cep || '',
      address_street: empreendimento?.address_street || '',
      address_number: empreendimento?.address_number || '',
      address_complement: empreendimento?.address_complement || '',
      neighborhood: empreendimento?.neighborhood || '',
      city: empreendimento?.city || '',
      state: empreendimento?.state || '',
      terreno_area_total: empreendimento?.terreno_area_total || '',
      data_inicio: empreendimento?.data_inicio || '',
      data_fim_prevista: empreendimento?.data_fim_prevista || '',
      prazo_entrega: empreendimento?.prazo_entrega || '',
      incorporadora_id: empreendimento?.incorporadora_id || null,
      construtora_id: empreendimento?.construtora_id || null,
      empresa_proprietaria_id: empreendimento?.empresa_proprietaria_id || null,
      matricula_numero: empreendimento?.matricula_numero || '',
      matricula_cartorio: empreendimento?.matricula_cartorio || '',
      estrutura_tipo: empreendimento?.estrutura_tipo || '',
      alvenaria_tipo: empreendimento?.alvenaria_tipo || '',
      cobertura_detalhes: empreendimento?.cobertura_detalhes || '',
      dados_contrato: empreendimento?.dados_contrato || '',
      indice_reajuste: empreendimento?.indice_reajuste || '',
    };
    setFormData(initialState);
    
    // --- INÍCIO DA ALTERAÇÃO ---
    // Preenche os nomes da incorporadora e construtora no estado de busca ao carregar
    if (empreendimento) {
        const incorporadora = corporateEntities.find(e => e.id === empreendimento.incorporadora_id);
        const construtora = corporateEntities.find(e => e.id === empreendimento.construtora_id);
        setSearchTerms({
            incorporadora: incorporadora ? (incorporadora.nome || incorporadora.razao_social) : '',
            construtora: construtora ? (construtora.nome || construtora.razao_social) : ''
        });
    }
    // --- FIM DA ALTERAÇÃO ---

  }, [empreendimento, corporateEntities]);
  
  const handleMaskedChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  // --- INÍCIO DAS NOVAS FUNÇÕES ---
  const handleSearchChange = async (type, term) => {
    setSearchTerms(prev => ({ ...prev, [type]: term }));
    if (term.length < 2) {
      setSearchResults(prev => ({ ...prev, [type]: [] }));
      return;
    }

    setIsSearching(prev => ({ ...prev, [type]: true }));
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, razao_social, nome_fantasia')
      .or(`nome.ilike.%${term}%,razao_social.ilike.%${term}%,nome_fantasia.ilike.%${term}%`)
      .limit(10);
      
    if (error) {
      console.error(`Erro ao buscar ${type}:`, error);
    } else {
      setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    }
    setIsSearching(prev => ({ ...prev, [type]: false }));
  };
  
  const handleSelectEntity = (type, entity) => {
    setFormData(prev => ({ ...prev, [`${type}_id`]: entity.id }));
    setSearchTerms(prev => ({ ...prev, [type]: entity.razao_social || entity.nome }));
    setSearchResults(prev => ({ ...prev, [type]: [] }));
  };

  const handleClearEntity = (type) => {
    setFormData(prev => ({ ...prev, [`${type}_id`]: null }));
    setSearchTerms(prev => ({ ...prev, [type]: '' }));
    setSearchResults(prev => ({ ...prev, [type]: [] }));
  };
  // --- FIM DAS NOVAS FUNÇÕES ---

  const handleCepBlur = useCallback(async (e) => {
    const cep = e.target.value?.replace(/\D/g, '');
    if (cep?.length !== 8) return;
    setIsApiLoading(true);
    const promise = fetch(`/api/cep?cep=${cep}`).then(async (response) => {
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error); }
        return response.json();
    });
    toast.promise(promise, {
      loading: 'Buscando CEP...',
      success: (data) => {
        setFormData((prev) => ({ ...prev, cep: data.cep, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }));
        setIsApiLoading(false);
        return 'Endereço preenchido!';
      },
      error: (err) => { setIsApiLoading(false); return `Erro: ${err.message}`; },
    });
  }, []);

  const handleAnalysisComplete = (data) => {
      setFormData(prev => ({
        ...prev,
        ...data
      }));
      toast.success('Campos preenchidos pela IA! Por favor, revise os dados.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const dataToSubmit = { ...formData };
    
    const promise = new Promise(async (resolve, reject) => {
        if (empreendimento) {
            const { error } = await supabase.from('empreendimentos').update(dataToSubmit).eq('id', empreendimento.id);
            if (error) reject(error); else resolve();
        } else {
            const { data, error } = await supabase.from('empreendimentos').insert(dataToSubmit).select().single();
            if (error) reject(error); else resolve(data);
        }
    });
    toast.promise(promise, {
      loading: 'Salvando...',
      success: (data) => {
        setLoading(false);
        const newId = data ? data.id : empreendimento.id;
        router.push(`/empreendimentos/${newId}`);
        router.refresh();
        return `Empreendimento salvo com sucesso!`;
      },
      error: (err) => { setLoading(false); return `Erro: ${err.message}`; },
    });
  };

  const promptAnaliseMatricula = `
    Analise a imagem da matrícula do imóvel e extraia as seguintes informações no formato JSON:
    - "nome_empreendimento": O nome oficial do empreendimento ou condomínio.
    - "matricula_numero": O número da matrícula.
    - "matricula_cartorio": O nome ou número do cartório de registro.
    - "terreno_area_total": A área total do terreno em metros quadrados (apenas números).
    - "address_street": O logradouro (rua, avenida) do imóvel.
    - "address_number": O número do imóvel.
    - "neighborhood": O bairro do imóvel.
    - "city": A cidade do imóvel.
    - "state": O estado (UF) do imóvel.
    `;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      {!isEditing && (
        <FileUploadWithAI 
            onAnalysisComplete={handleAnalysisComplete}
            analysisEndpoint="/api/empreendimentos/analyze-document"
            prompt={promptAnaliseMatricula}
        />
      )}

      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Dados Gerais</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="nome" className="block text-sm font-medium">Nome (Fantasia) *</label>
            <input type="text" id="nome" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/>
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium">Status *</label>
            <select id="status" name="status" value={formData.status || 'Em Planejamento'} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
              <option>Em Planejamento</option> <option>Em Lançamento</option> <option>Em Obras</option>
              <option>Entregue</option> <option>Cancelado</option>
            </select>
          </div>
        </div>
      </fieldset>
      
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Endereço</legend>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            <div className="md:col-span-2"> <label className="block text-sm font-medium">CEP</label> <IMaskInput mask="00000-000" name="cep" onAccept={(v) => handleMaskedChange('cep', v)} onBlur={handleCepBlur} value={formData.cep || ''} className="w-full p-2 border rounded-md"/> </div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Rua</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-3"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
        </div>
      </fieldset>
      
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Dados de Registro e Prazos</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            <div className="md:col-span-2"><label className="block text-sm font-medium">Nome Oficial (Cartório)</label><input type="text" name="nome_empreendimento" value={formData.nome_empreendimento || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Área do Terreno (m²)</label><input type="number" step="0.01" name="terreno_area_total" value={formData.terreno_area_total || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Nº da Matrícula</label><input type="text" name="matricula_numero" value={formData.matricula_numero || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Cartório de Registro</label><input type="text" name="matricula_cartorio" value={formData.matricula_cartorio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Data de Início</label><input type="date" name="data_inicio" value={formData.data_inicio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Previsão de Término</label><input type="date" name="data_fim_prevista" value={formData.data_fim_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
        </div>
      </fieldset>
      
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Entidades Envolvidas</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <label className="block text-sm font-medium">Empresa Proprietária *</label>
                <select name="empresa_proprietaria_id" value={formData.empresa_proprietaria_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                    <option value="">Selecione...</option>
                    {proprietariaOptions.map(o => (<option key={o.id} value={o.id}>{o.razao_social}</option>))}
                </select>
            </div>
            
            {/* Campo de Busca para Incorporadora */}
            <div className="relative">
                <label className="block text-sm font-medium">Incorporadora</label>
                {formData.incorporadora_id ? (
                    <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                        <span className="font-semibold text-gray-800">{searchTerms.incorporadora}</span>
                        <button type="button" onClick={() => handleClearEntity('incorporadora')} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTimes}/></button>
                    </div>
                ) : (
                    <>
                        <input type="text" value={searchTerms.incorporadora} onChange={(e) => handleSearchChange('incorporadora', e.target.value)} placeholder="Buscar..." className="mt-1 w-full p-2 border rounded-md"/>
                        {isSearching.incorporadora && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-10 text-gray-400" />}
                        {searchResults.incorporadora.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                                {searchResults.incorporadora.map(e => (<li key={e.id} onClick={() => handleSelectEntity('incorporadora', e)} className="p-2 hover:bg-gray-100 cursor-pointer">{e.razao_social || e.nome}</li>))}
                            </ul>
                        )}
                    </>
                )}
            </div>

            {/* Campo de Busca para Construtora */}
            <div className="relative">
                <label className="block text-sm font-medium">Construtora</label>
                {formData.construtora_id ? (
                     <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                        <span className="font-semibold text-gray-800">{searchTerms.construtora}</span>
                        <button type="button" onClick={() => handleClearEntity('construtora')} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTimes}/></button>
                    </div>
                ) : (
                    <>
                        <input type="text" value={searchTerms.construtora} onChange={(e) => handleSearchChange('construtora', e.target.value)} placeholder="Buscar..." className="mt-1 w-full p-2 border rounded-md"/>
                        {isSearching.construtora && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-10 text-gray-400" />}
                        {searchResults.construtora.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                                {searchResults.construtora.map(e => (<li key={e.id} onClick={() => handleSelectEntity('construtora', e)} className="p-2 hover:bg-gray-100 cursor-pointer">{e.razao_social || e.nome}</li>))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </div>
      </fieldset>
      
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Características Construtivas</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-sm font-medium">Tipo de Estrutura</label><input name="estrutura_tipo" value={formData.estrutura_tipo || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Alvenaria Estrutural"/></div>
            <div><label className="block text-sm font-medium">Tipo de Alvenaria</label><input name="alvenaria_tipo" value={formData.alvenaria_tipo || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Bloco Cerâmico"/></div>
            <div><label className="block text-sm font-medium">Detalhes da Cobertura</label><input name="cobertura_detalhes" value={formData.cobertura_detalhes || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Telha Cerâmica"/></div>
        </div>
      </fieldset>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <button type="button" onClick={() => router.back()} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
        <button type="submit" disabled={loading || isApiLoading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
          {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : (empreendimento ? 'Salvar Alterações' : 'Salvar e Continuar')}
        </button>
      </div>
    </form>
  );
}