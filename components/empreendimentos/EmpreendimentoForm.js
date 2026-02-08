// components/EmpreendimentoForm.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faImage, faCheckCircle, faSave, faSync, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import FileUploadWithAI from '@/components/shared/FileUploadWithAI';
import ThumbnailUploader from '@/components/shared/ThumbnailUploader'; 
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

export default function EmpreendimentoForm({ empreendimento, corporateEntities = [], proprietariaOptions = [] }) {
  // --- ESTADOS ---
  const [formData, setFormData] = useState({});
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  
  // Estados de busca
  const [searchTerms, setSearchTerms] = useState({ incorporadora: '', construtora: '' });
  const [searchResults, setSearchResults] = useState({ incorporadora: [], construtora: [] });
  const [isSearching, setIsSearching] = useState({ incorporadora: false, construtora: false });

  // Refs para controle do Auto-Save
  const timeoutRef = useRef(null);
  const isFirstRender = useRef(true);

  // --- HOOKS ---
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { userData } = useAuth();
  
  const isEditing = Boolean(empreendimento);

  // --- INICIALIZAÇÃO ---
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
      thumbnail_url: empreendimento?.thumbnail_url || null,
      logo_url: empreendimento?.logo_url || null,
      // NOVO CAMPO
      observacoes: empreendimento?.observacoes || '*Correção mensal pelo INCC até a entrega das chaves, após entrega IGP-M + 1% a.m.\n**Sujeito a alteração sem aviso prévio.', 
    };
    setFormData(initialState);
    
    if (empreendimento) {
        const incorporadora = corporateEntities.find(e => e.id === empreendimento.incorporadora_id);
        const construtora = corporateEntities.find(e => e.id === empreendimento.construtora_id);
        setSearchTerms({
            incorporadora: incorporadora ? (incorporadora.nome || incorporadora.razao_social) : '',
            construtora: construtora ? (construtora.nome || construtora.razao_social) : ''
        });
    }
  }, [empreendimento, corporateEntities]);

  // --- MUTATION DE SALVAMENTO ---
  const { mutateAsync: saveEmpreendimento } = useMutation({
    mutationFn: async (data) => {
      const dataToSubmit = { 
        ...data, 
        organizacao_id: userData.organizacao_id 
      };

      if (isEditing) {
        const { error } = await supabase.from('empreendimentos').update(dataToSubmit).eq('id', empreendimento.id);
        if (error) throw error;
        return empreendimento.id;
      } else {
        const { data: newData, error } = await supabase.from('empreendimentos').insert(dataToSubmit).select().single();
        if (error) throw error;
        return newData.id;
      }
    },
    onSuccess: (savedId) => {
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
      if (!isEditing) {
          toast.success('Empreendimento criado! Ativando salvamento automático...');
          router.push(`/empreendimentos/editar/${savedId}`);
      }
    },
    onError: (error) => {
      setSaveStatus('error');
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  });

  // --- LÓGICA DE AUTO-SAVE ---
  const triggerAutoSave = useCallback(async (currentData) => {
      if (!isEditing) return; 
      
      setSaveStatus('saving');
      try {
          await saveEmpreendimento(currentData);
      } catch (error) {
          console.error("Auto-save failed", error);
      }
  }, [isEditing, saveEmpreendimento]);

  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      if (!isEditing) return;

      setSaveStatus('idle'); 

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(() => {
          triggerAutoSave(formData);
      }, 2000);

      return () => clearTimeout(timeoutRef.current);
  }, [formData, triggerAutoSave, isEditing]);

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpdate = (field, url) => {
      const newData = { ...formData, [field]: url };
      setFormData(newData);
      if (isEditing) {
          setSaveStatus('saving');
          saveEmpreendimento(newData);
      }
  };

  const handleManualSave = async (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
        await saveEmpreendimento(formData);
        toast.success('Salvo com sucesso!');
        router.back(); 
    } catch (err) {
    }
  };

  // --- BUSCAS E CEP ---
  const handleSearchChange = async (type, term) => {
    setSearchTerms(prev => ({ ...prev, [type]: term }));
    if (term.length < 2) { setSearchResults(prev => ({ ...prev, [type]: [] })); return; }
    setIsSearching(prev => ({ ...prev, [type]: true }));
    const { data } = await supabase.from('contatos').select('id, nome, razao_social').or(`nome.ilike.%${term}%,razao_social.ilike.%${term}%`).eq('organizacao_id', userData.organizacao_id).limit(10);
    setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    setIsSearching(prev => ({ ...prev, [type]: false }));
  };
  
  const handleSelectEntity = (type, entity) => {
    setFormData(prev => ({ ...prev, [`${type}_id`]: entity.id }));
    setSearchTerms(prev => ({ ...prev, [type]: entity.razao_social || entity.nome }));
    setSearchResults(prev => ({ ...prev, [type]: [] })); 
  };

  const handleCepBlur = useCallback(async (e) => {
    const cep = e.target.value?.replace(/\D/g, '');
    if (cep?.length !== 8) return;
    setIsApiLoading(true);
    try {
        const response = await fetch(`/api/cep?cep=${cep}`);
        const data = await response.json();
        setFormData((prev) => ({ ...prev, cep: data.cep, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }));
    } catch(err) { toast.error("Erro ao buscar CEP"); }
    setIsApiLoading(false);
  }, []);

  // --- RENDER ---
  return (
    <form onSubmit={handleManualSave} className="space-y-8 relative">
      
      {isEditing && (
          <div className="fixed top-20 right-8 z-50 bg-white shadow-lg rounded-full px-4 py-2 border border-gray-100 flex items-center gap-2 text-sm font-medium transition-all duration-300">
              {saveStatus === 'saving' && <><FontAwesomeIcon icon={faSync} spin className="text-blue-500"/> <span className="text-gray-600">Salvando alterações...</span></>}
              {saveStatus === 'saved' && <><FontAwesomeIcon icon={faCheckCircle} className="text-green-500"/> <span className="text-green-700">Tudo salvo!</span></>}
              {saveStatus === 'error' && <><FontAwesomeIcon icon={faTimes} className="text-red-500"/> <span className="text-red-600">Erro ao salvar</span></>}
              {saveStatus === 'idle' && lastSavedAt && <span className="text-gray-400 text-xs">Salvo às {lastSavedAt.toLocaleTimeString()}</span>}
          </div>
      )}

      {!isEditing && (
        <FileUploadWithAI 
          onAnalysisComplete={(data) => { setFormData(prev => ({ ...prev, ...data })); toast.success('Dados preenchidos via IA!'); }}
          analysisEndpoint="/api/empreendimentos/analyze-document"
          prompt="Analise a matrícula e extraia: nome_empreendimento, matricula_numero, terreno_area_total, address_street..."
        />
      )}

      {/* SEÇÃO IMAGENS */}
      <fieldset>
         <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faImage} className="text-blue-500"/>
            Identidade Visual
         </legend>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
                <ThumbnailUploader 
                    label="Imagem de Capa (Thumbnail)"
                    url={formData.thumbnail_url} 
                    onUpload={(url) => handleImageUpdate('thumbnail_url', url)} 
                    bucketName="empreendimentos"
                />
            </div>
            <div>
                <ThumbnailUploader 
                    label="Logo do Empreendimento"
                    url={formData.logo_url} 
                    onUpload={(url) => handleImageUpdate('logo_url', url)} 
                    bucketName="empreendimentos"
                    aspectRatio="aspect-square" 
                    objectFit="object-contain"
                />
            </div>
         </div>
      </fieldset>

      {/* CAMPOS GERAIS */}
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Dados Gerais</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">Nome (Fantasia) *</label>
            <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"/>
          </div>
          <div>
            <label className="block text-sm font-medium">Status *</label>
            <select name="status" value={formData.status || 'Em Planejamento'} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
              <option>Em Planejamento</option> <option>Em Lançamento</option> <option>Em Obras</option> <option>Entregue</option>
            </select>
          </div>
        </div>
      </fieldset>
      
      {/* ENDEREÇO */}
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

      {/* DADOS REGISTRO */}
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Registro e Prazos</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-sm font-medium">Área Terreno (m²)</label><input type="number" name="terreno_area_total" value={formData.terreno_area_total || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Nome Oficial (Cartório)</label><input type="text" name="nome_empreendimento" value={formData.nome_empreendimento || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Matrícula</label><input type="text" name="matricula_numero" value={formData.matricula_numero || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Cartório</label><input type="text" name="matricula_cartorio" value={formData.matricula_cartorio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Início</label><input type="date" name="data_inicio" value={formData.data_inicio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Término Previsto</label><input type="date" name="data_fim_prevista" value={formData.data_fim_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
        </div>
      </fieldset>
      
      {/* OBSERVAÇÕES (NOVO!) */}
      <fieldset>
         <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faFileAlt} className="text-orange-500"/>
            Observações da Tabela de Vendas
         </legend>
         <div className="grid grid-cols-1 gap-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto de Observação (Rodapé da Tabela)</label>
                <textarea 
                    name="observacoes"
                    rows={4}
                    value={formData.observacoes || ''}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Ex: *Correção mensal pelo INCC... **1 Vaga de garagem..."
                />
                <p className="text-xs text-gray-500 mt-1">Este texto aparecerá no rodapé da tabela de vendas impressa.</p>
            </div>
         </div>
      </fieldset>
      
      {/* ENTIDADES (COM BUSCA) */}
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Entidades</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <label className="block text-sm font-medium">Proprietária</label>
                <select name="empresa_proprietaria_id" value={formData.empresa_proprietaria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                    <option value="">Selecione...</option>
                    {proprietariaOptions.map(o => (<option key={o.id} value={o.id}>{o.razao_social}</option>))}
                </select>
            </div>
            
            {/* INCORPORADORA */}
            <div className="relative">
                <label className="block text-sm font-medium">Incorporadora</label>
                {formData.incorporadora_id ? (
                    <div className="flex items-center justify-between mt-1 p-2 bg-gray-100 rounded-md">
                        <span>{searchTerms.incorporadora}</span>
                        <button type="button" onClick={() => setFormData(p => ({...p, incorporadora_id: null}))}><FontAwesomeIcon icon={faTimes} className="text-red-500"/></button>
                    </div>
                ) : (
                    <>
                        <input type="text" value={searchTerms.incorporadora} onChange={(e) => handleSearchChange('incorporadora', e.target.value)} placeholder="Buscar..." className="mt-1 w-full p-2 border rounded-md"/>
                        {searchResults.incorporadora.length > 0 && <ul className="absolute z-10 w-full bg-white border shadow-lg max-h-48 overflow-y-auto">{searchResults.incorporadora.map(e => (<li key={e.id} onClick={() => handleSelectEntity('incorporadora', e)} className="p-2 hover:bg-gray-100 cursor-pointer">{e.razao_social}</li>))}</ul>}
                    </>
                )}
            </div>

            {/* CONSTRUTORA */}
            <div className="relative">
                <label className="block text-sm font-medium">Construtora</label>
                {formData.construtora_id ? (
                    <div className="flex items-center justify-between mt-1 p-2 bg-gray-100 rounded-md">
                        <span>{searchTerms.construtora}</span>
                        <button type="button" onClick={() => setFormData(p => ({...p, construtora_id: null}))}><FontAwesomeIcon icon={faTimes} className="text-red-500"/></button>
                    </div>
                ) : (
                    <>
                        <input type="text" value={searchTerms.construtora} onChange={(e) => handleSearchChange('construtora', e.target.value)} placeholder="Buscar..." className="mt-1 w-full p-2 border rounded-md"/>
                        {searchResults.construtora.length > 0 && <ul className="absolute z-10 w-full bg-white border shadow-lg max-h-48 overflow-y-auto">{searchResults.construtora.map(e => (<li key={e.id} onClick={() => handleSelectEntity('construtora', e)} className="p-2 hover:bg-gray-100 cursor-pointer">{e.razao_social}</li>))}</ul>}
                    </>
                )}
            </div>
        </div>
      </fieldset>

      {/* BOTÕES */}
      <div className="flex justify-end gap-4 pt-4 border-t sticky bottom-0 bg-white p-4 shadow-top z-10">
        <div className="flex items-center gap-2 mr-auto text-sm text-gray-500 italic">
            {isEditing ? 'As alterações são salvas automaticamente.' : 'Salve a primeira vez para ativar o auto-save.'}
        </div>
        
        <button type="button" onClick={() => router.back()} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
            Cancelar
        </button>
        
        <button type="submit" disabled={saveStatus === 'saving'} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2 transition-all">
            {saveStatus === 'saving' ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            {isEditing ? 'Salvar e Voltar' : 'Criar Empreendimento'}
        </button>
      </div>
    </form>
  );
}