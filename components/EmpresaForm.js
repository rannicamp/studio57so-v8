// components/EmpresaForm.js

"use client";

// --------------------------------------------------------------------------------
// IMPORTAÇÕES
// --------------------------------------------------------------------------------
// Hooks do React para gerenciar estado e efeitos colaterais
import { useState, useEffect, useCallback } from 'react';
// Função para criar um cliente Supabase no lado do cliente
import { createClient } from '../utils/supabase/client';
// Hook do Next.js para navegação entre páginas
import { useRouter } from 'next/navigation';
// Componente para criar máscaras de input (CNPJ, CEP, Telefone)
import { IMaskInput } from 'react-imask';
// Biblioteca para exibir notificações (toasts)
import { toast } from 'sonner';
// Hooks da biblioteca TanStack Query para gerenciar o estado do servidor
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Hook do nosso contexto de autenticação para obter dados do usuário logado
import { useAuth } from '../contexts/AuthContext';
// Ícones da biblioteca FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// --------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------------------------
export default function EmpresaForm({ initialData }) {
  // --------------------------------------------------------------------------------
  // HOOKS E VARIÁVEIS
  // --------------------------------------------------------------------------------
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userData } = useAuth(); // Pega os dados do usuário logado
  const isEditing = Boolean(initialData);

  // Define o estado inicial do formulário, usado tanto para criar um novo quanto para limpar
  const getInitialState = () => ({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    telefone: '',
    email: '',
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    responsavel_legal: '',
  });

  // --------------------------------------------------------------------------------
  // ESTADOS DO COMPONENTE
  // --------------------------------------------------------------------------------
  const [formData, setFormData] = useState(initialData || getInitialState());

  // Efeito que preenche o formulário com dados existentes quando estamos no modo de edição
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // --------------------------------------------------------------------------------
  // FUNÇÕES DE MANIPULAÇÃO DE DADOS (HANDLERS)
  // --------------------------------------------------------------------------------
  // Manipulador genérico para a maioria dos inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  // Manipulador para inputs com máscara
  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  // Busca o endereço a partir do CEP usando a API do ViaCEP
  // Refatorado para usar 'toast.promise' para uma melhor experiência do usuário
  const handleCepBlur = useCallback(async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    const promise = fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`).then(async (response) => {
      if (!response.ok) throw new Error('Falha ao buscar CEP.');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado.');
      return data;
    });

    toast.promise(promise, {
      loading: 'Buscando CEP...',
      success: (data) => {
        setFormData(prev => ({
          ...prev,
          address_street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
        }));
        return 'Endereço preenchido!';
      },
      error: (err) => `Erro: ${err.message}`,
    });
  }, []);

  // --------------------------------------------------------------------------------
  // MUTATION (useMutation) - A FORMA MODERNA DE SALVAR DADOS
  // --------------------------------------------------------------------------------
  const { mutate: saveEmpresa, isPending: isSaving } = useMutation({
    mutationFn: async (data) => {
      // **O CARIMBO DA ORGANIZAÇÃO!**
      // Adicionamos o 'organizacao_id' do usuário logado aos dados a serem salvos.
      const dataToSubmit = { 
        ...data, 
        organizacao_id: userData.organizacao_id 
      };
      
      // Remove o ID do objeto para evitar problemas no insert, pois o Supabase o gera automaticamente.
      // Apenas no 'update' precisamos do ID para a cláusula 'eq'.
      const { id, ...dbData } = dataToSubmit;

      if (isEditing) {
        const { error } = await supabase.from('cadastro_empresa').update(dbData).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cadastro_empresa').insert(dbData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Empresa ${isEditing ? 'atualizada' : 'cadastrada'} com sucesso!`);
      // Invalida a query de empresas para que a lista seja atualizada na próxima visita
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      router.push('/empresas');
      router.refresh();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Função chamada no submit do formulário
  const handleSubmit = (event) => {
    event.preventDefault();
    // Verifica se os dados do usuário (e a organização) foram carregados antes de salvar
    if (!userData?.organizacao_id) {
        toast.error("Não foi possível identificar a organização. Tente novamente.");
        return;
    }
    saveEmpresa(formData);
  };

  // --------------------------------------------------------------------------------
  // RENDERIZAÇÃO DO COMPONENTE (JSX)
  // --------------------------------------------------------------------------------
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">
        {isEditing ? `Editando Empresa: ${initialData.razao_social}` : 'Cadastro de Nova Empresa'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados da Empresa</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium">Razão Social *</label>
              <input name="razao_social" required onChange={handleChange} value={formData.razao_social || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium">Nome Fantasia</label>
              <input name="nome_fantasia" onChange={handleChange} value={formData.nome_fantasia || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium">CNPJ *</label>
              <IMaskInput mask="00.000.000/0000-00" name="cnpj" required onAccept={(v) => handleMaskedChange('cnpj', v)} value={formData.cnpj || ''} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div>
              <label className="block text-sm font-medium">Inscrição Estadual</label>
              <input name="inscricao_estadual" onChange={handleChange} value={formData.inscricao_estadual || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium">Inscrição Municipal</label>
              <input name="inscricao_municipal" onChange={handleChange} value={formData.inscricao_municipal || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Contato</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium">Telefone</label>
                <IMaskInput mask="(00) 00000-0000" name="telefone" onAccept={(v) => handleMaskedChange('telefone', v)} value={formData.telefone || ''} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div>
                <label className="block text-sm font-medium">Email</label>
                <input type="email" name="email" onChange={handleChange} value={formData.email || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium">Responsável Legal</label>
                <input name="responsavel_legal" onChange={handleChange} value={formData.responsavel_legal || ''} className="mt-1 w-full p-2 border rounded-md" />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Endereço</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-6">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium">CEP</label>
                <IMaskInput mask="00000-000" name="cep" value={formData.cep || ''} onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Logradouro</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-3"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
          </div>
        </fieldset>

        <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="button" onClick={() => router.push('/empresas')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
            <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 font-semibold disabled:bg-gray-400 flex items-center gap-2">
                {isSaving && <FontAwesomeIcon icon={faSpinner} spin />}
                {isEditing ? 'Salvar Alterações' : 'Salvar Empresa'}
            </button>
        </div>
      </form>
    </div>
  );
}

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente é o formulário para CRIAR e EDITAR uma "Empresa" na tabela 'cadastro_empresa'.
// Ele é o principal ponto de entrada de dados para as empresas que farão parte do sistema,
// como por exemplo as "Empresas Proprietárias" de um empreendimento.
//
// Funcionalidades Principais:
// - Adição de 'organizacao_id': O formulário agora utiliza o `useAuth` para capturar
//   a organização do usuário logado e associá-la a cada nova empresa cadastrada.
//   Isso é crucial para a arquitetura multi-inquilino do sistema.
// - Lógica de Salvamento Refatorada: A função `handleSubmit` foi modernizada para
//   usar o hook `useMutation` do TanStack Query. Isso centraliza o gerenciamento
//   de estados de carregamento, sucesso e erro, simplificando o código.
// - Notificações Modernas: As mensagens de feedback para o usuário (como sucesso,
//   erro, buscando CEP) foram substituídas por notificações 'toast', proporcionando
//   uma experiência de usuário mais limpa e moderna.
// - Busca de CEP: Mantém a funcionalidade de preencher o endereço automaticamente
//   a partir do CEP, agora com feedback visual aprimorado pelos toasts.
// --------------------------------------------------------------------------------