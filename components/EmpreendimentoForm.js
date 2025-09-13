// components/EmpreendimentoForm.js

'use client';

// --------------------------------------------------------------------------------
// IMPORTAÇÕES
// --------------------------------------------------------------------------------
// Hooks do React para gerenciar estado (useState), efeitos colaterais (useEffect, useCallback)
import { useState, useEffect, useCallback } from 'react';
// Hook do Next.js para navegação entre páginas
import { useRouter } from 'next/navigation';
// Função para criar um cliente Supabase no lado do cliente
import { createClient } from '../utils/supabase/client';
// Biblioteca para exibir notificações (toasts) elegantes
import { toast } from 'sonner';
// Ícones da biblioteca FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
// Componente para criar máscaras de input (ex: CEP)
import { IMaskInput } from 'react-imask';
// Componente personalizado para upload de arquivos com análise de IA
import FileUploadWithAI from './FileUploadWithAI';
// Hooks da biblioteca TanStack Query para gerenciar estado do servidor
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Hook do nosso contexto de autenticação para pegar dados do usuário logado
import { useAuth } from '../contexts/AuthContext';


// --------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------------------------
export default function EmpreendimentoForm({ empreendimento, corporateEntities = [], proprietariaOptions = [] }) {
  // --------------------------------------------------------------------------------
  // ESTADOS DO COMPONENTE
  // --------------------------------------------------------------------------------
  // Armazena todos os dados do formulário do empreendimento
  const [formData, setFormData] = useState({});
  // Controla o estado de carregamento de APIs externas, como a de CEP
  const [isApiLoading, setIsApiLoading] = useState(false);
  // Armazena os termos de busca para incorporadora e construtora
  const [searchTerms, setSearchTerms] = useState({ incorporadora: '', construtora: '' });
  // Armazena os resultados da busca para incorporadora e construtora
  const [searchResults, setSearchResults] = useState({ incorporadora: [], construtora: [] });
  // Controla o estado de "buscando..." para os campos de incorporadora e construtora
  const [isSearching, setIsSearching] = useState({ incorporadora: false, construtora: false });

  // --------------------------------------------------------------------------------
  // HOOKS E VARIÁVEIS
  // --------------------------------------------------------------------------------
  // Hook para navegação
  const router = useRouter();
  // Cria uma instância do cliente Supabase
  const supabase = createClient();
  // Hook para acessar o Query Client do TanStack Query, usado para invalidar caches
  const queryClient = useQueryClient();
  // **AQUI ESTÁ A NOSSA MÁGICA!** Pega os dados do usuário logado do nosso contexto
  const { userData } = useAuth();
  
  // Variável booleana para verificar se estamos editando um empreendimento existente
  const isEditing = Boolean(empreendimento);

  // --------------------------------------------------------------------------------
  // EFEITO INICIAL (useEffect)
  // --------------------------------------------------------------------------------
  // Roda quando o componente é montado ou quando 'empreendimento' ou 'corporateEntities' mudam.
  // Sua função é preencher o formulário com os dados existentes se estivermos editando.
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
    
    // Preenche os nomes da incorporadora e construtora no estado de busca ao carregar
    if (empreendimento) {
        const incorporadora = corporateEntities.find(e => e.id === empreendimento.incorporadora_id);
        const construtora = corporateEntities.find(e => e.id === empreendimento.construtora_id);
        setSearchTerms({
            incorporadora: incorporadora ? (incorporadora.nome || incorporadora.razao_social) : '',
            construtora: construtora ? (construtora.nome || construtora.razao_social) : ''
        });
    }
  }, [empreendimento, corporateEntities]);
  
  // --------------------------------------------------------------------------------
  // FUNÇÕES DE MANIPULAÇÃO DE DADOS (HANDLERS)
  // --------------------------------------------------------------------------------

  // Função para lidar com mudanças em inputs com máscara
  const handleMaskedChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Função genérica para lidar com mudanças na maioria dos inputs do formulário
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  // Função para buscar contatos (incorporadora/construtora) dinamicamente
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
      .eq('organizacao_id', userData.organizacao_id) // Garante que só busque contatos da mesma organização
      .limit(10);
      
    if (error) {
      console.error(`Erro ao buscar ${type}:`, error);
      toast.error(`Falha ao buscar ${type}.`);
    } else {
      setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    }
    setIsSearching(prev => ({ ...prev, [type]: false }));
  };
  
  // Função chamada quando uma entidade (incorporadora/construtora) é selecionada da lista de busca
  const handleSelectEntity = (type, entity) => {
    setFormData(prev => ({ ...prev, [`${type}_id`]: entity.id }));
    setSearchTerms(prev => ({ ...prev, [type]: entity.razao_social || entity.nome }));
    setSearchResults(prev => ({ ...prev, [type]: [] })); // Limpa os resultados da busca
  };

  // Função para limpar a seleção de uma entidade
  const handleClearEntity = (type) => {
    setFormData(prev => ({ ...prev, [`${type}_id`]: null }));
    setSearchTerms(prev => ({ ...prev, [type]: '' }));
    setSearchResults(prev => ({ ...prev, [type]: [] }));
  };

  // Função para buscar o endereço a partir do CEP usando uma API externa
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

  // Função chamada quando a análise de IA do documento (matrícula) é completada
  const handleAnalysisComplete = (data) => {
      setFormData(prev => ({
        ...prev,
        ...data
      }));
      toast.success('Campos preenchidos pela IA! Por favor, revise os dados.');
  };

  // --------------------------------------------------------------------------------
  // MUTATION (useMutation) - A FORMA MODERNA DE SALVAR DADOS
  // --------------------------------------------------------------------------------
  // Este hook do TanStack Query gerencia todo o ciclo de vida de uma mutação de dados:
  // - Ele nos dá o estado de 'isPending' (carregando).
  // - Ele chama a função 'mutationFn' para fazer a alteração no banco.
  // - Em caso de sucesso ('onSuccess'), ele executa ações como invalidar queries e navegar.
  // - Em caso de erro ('onError'), ele exibe uma notificação de erro.
  const { mutate: saveEmpreendimento, isPending: isSaving } = useMutation({
    mutationFn: async (data) => {
      // **O CARIMBO DA ORGANIZAÇÃO!**
      // Adicionamos o 'organizacao_id' do usuário logado aos dados que serão salvos.
      const dataToSubmit = { 
        ...data, 
        organizacao_id: userData.organizacao_id 
      };

      if (isEditing) {
        // Se estiver editando, faz um 'update'
        const { error } = await supabase.from('empreendimentos').update(dataToSubmit).eq('id', empreendimento.id);
        if (error) throw error;
        return empreendimento.id; // Retorna o ID existente
      } else {
        // Se for um novo registro, faz um 'insert'
        const { data: newData, error } = await supabase.from('empreendimentos').insert(dataToSubmit).select().single();
        if (error) throw error;
        return newData.id; // Retorna o ID do novo registro
      }
    },
    onSuccess: (savedId) => {
      // Ações a serem executadas após o sucesso da mutação
      toast.success('Empreendimento salvo com sucesso!');
      // Invalida a query de empreendimentos para garantir que a lista seja atualizada na próxima vez que for acessada
      queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
      // Redireciona para a página de detalhes do empreendimento salvo
      router.push(`/empreendimentos/${savedId}`);
      router.refresh();
    },
    onError: (error) => {
      // Exibe uma notificação de erro caso a mutação falhe
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  });

  // Função chamada quando o formulário é submetido
  const handleSubmit = (e) => {
    e.preventDefault(); // Previne o comportamento padrão de recarregar a página
    saveEmpreendimento(formData); // Chama a função de mutação para salvar os dados
  };

  // Prompt que será enviado para a IA analisar a matrícula do imóvel
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

  // --------------------------------------------------------------------------------
  // RENDERIZAÇÃO DO COMPONENTE (JSX)
  // --------------------------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      {/* Componente de Upload com IA, exibido apenas na criação de um novo empreendimento */}
      {!isEditing && (
        <FileUploadWithAI 
          onAnalysisComplete={handleAnalysisComplete}
          analysisEndpoint="/api/empreendimentos/analyze-document"
          prompt={promptAnaliseMatricula}
        />
      )}

      {/* Seção: Dados Gerais */}
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
      
      {/* Seção: Endereço */}
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
      
      {/* Seção: Dados de Registro e Prazos */}
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Dados de Registro e Prazos</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            <div><label className="block text-sm font-medium">Área do Terreno (m²)</label><input type="number" step="0.01" name="terreno_area_total" value={formData.terreno_area_total || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Nome Oficial (Cartório)</label><input type="text" name="nome_empreendimento" value={formData.nome_empreendimento || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Nº da Matrícula</label><input type="text" name="matricula_numero" value={formData.matricula_numero || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Cartório de Registro</label><input type="text" name="matricula_cartorio" value={formData.matricula_cartorio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Data de Início</label><input type="date" name="data_inicio" value={formData.data_inicio || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="block text-sm font-medium">Previsão de Término</label><input type="date" name="data_fim_prevista" value={formData.data_fim_prevista || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
        </div>
      </fieldset>
      
      {/* Seção: Entidades Envolvidas */}
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
      
      {/* Seção: Características Construtivas */}
      <fieldset>
        <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Características Construtivas</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-sm font-medium">Tipo de Estrutura</label><input name="estrutura_tipo" value={formData.estrutura_tipo || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Alvenaria Estrutural"/></div>
            <div><label className="block text-sm font-medium">Tipo de Alvenaria</label><input name="alvenaria_tipo" value={formData.alvenaria_tipo || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Bloco Cerâmico"/></div>
            <div><label className="block text-sm font-medium">Detalhes da Cobertura</label><input name="cobertura_detalhes" value={formData.cobertura_detalhes || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Telha Cerâmica"/></div>
        </div>
      </fieldset>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <button type="button" onClick={() => router.back()} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
        <button type="submit" disabled={isSaving || isApiLoading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
          {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : (empreendimento ? 'Salvar Alterações' : 'Salvar e Continuar')}
        </button>
      </div>
    </form>
  );
}


// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente é o formulário para CRIAR e EDITAR um "Empreendimento".
//
// Funcionalidades Principais:
// - Gerencia um formulário complexo com várias seções de dados.
// - Na criação, permite o upload de um documento (matrícula do imóvel) para
//   análise por Inteligência Artificial, que preenche alguns campos automaticamente.
// - Possui um campo de busca de CEP que preenche os dados de endereço.
// - Inclui campos de busca dinâmicos para selecionar a "Incorporadora" e a
//   "Construtora" a partir da tabela de contatos, garantindo que os dados sejam consistentes.
// - Utiliza o hook `useAuth` para obter o `organizacao_id` do usuário logado e
//   associa-lo a cada novo empreendimento, garantindo o isolamento dos dados.
// - A lógica de salvar os dados foi refatorada para usar o hook `useMutation` do
//   TanStack Query, que centraliza o estado de carregamento (loading), sucesso e erro,
//   além de invalidar o cache para manter a interface sempre atualizada.
// --------------------------------------------------------------------------------