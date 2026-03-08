// app/cadastro/page.js

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, ChevronRight, ChevronLeft, CheckCircle2, Factory, Loader2 } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { signUpAction } from './actions';
import { buscarCNPJ, buscarCEP } from '@/utils/apiConsultas';

export default function CadastroPage() {
  const router = useRouter();

  // Estados do Wizard
  const [step, setStep] = useState(1);
  const [tipoPessoa, setTipoPessoa] = useState(null); // 'PF' ou 'PJ'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados de Busca Externa
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);

  // Payload Completo do Formulário
  const [formData, setFormData] = useState({
    // Dados Essenciais Empresa/PF
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    cpf: '',

    // Endereço
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',

    // Dados Administrador
    admin_nome: '',
    admin_email: '',
    admin_senha: '',
    admin_senha_confirmacao: '',
    admin_telefone: '',
  });

  const updateForm = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateFormDirectly = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  // Máscaras e Validadores
  const isCnpjValid = formData.cnpj.replace(/\D/g, '').length === 14;
  const isCpfValid = formData.cpf.replace(/\D/g, '').length === 11;
  const isCepValid = formData.cep.replace(/\D/g, '').length === 8;

  // Navegação
  const nextStep = () => {
    setError('');

    // Validação Passo 1
    if (step === 1 && !tipoPessoa) {
      setError('Selecione PF ou PJ para prosseguir.');
      return;
    }

    // Validação Passo 2 (PJ)
    if (step === 2 && tipoPessoa === 'PJ') {
      if (!isCnpjValid) return setError('Digite um CNPJ válido.');
      if (!formData.razao_social.trim()) return setError('A Razão Social é obrigatória.');
    }

    // Validação Passo 2 (PF)
    if (step === 2 && tipoPessoa === 'PF') {
      if (!isCpfValid) return setError('Digite um CPF válido.');
      if (!formData.admin_nome.trim()) return setError('O Nome Completo é obrigatório.');
    }

    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  // Buscas Externas
  const handleBuscarCNPJ = async () => {
    if (!isCnpjValid || buscandoCNPJ) return;
    setBuscandoCNPJ(true);
    setError('');

    const { data, error } = await buscarCNPJ(formData.cnpj);

    if (error) {
      setError(error);
    } else if (data) {
      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || data.razao_social || '',
        cep: data.cep || '',
        address_street: data.logradouro || '',
        address_number: data.numero || '',
        address_complement: data.complemento || '',
        neighborhood: data.bairro || '',
        city: data.municipio || '',
        state: data.uf || '',
      }));
    }

    setBuscandoCNPJ(false);
  };

  const handleBuscarCEP = async () => {
    if (!isCepValid || buscandoCEP) return;
    setBuscandoCEP(true);
    setError('');

    const { data, error } = await buscarCEP(formData.cep);

    if (error) {
      setError(error);
    } else if (data) {
      setFormData(prev => ({
        ...prev,
        address_street: data.logradouro || prev.address_street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    }

    setBuscandoCEP(false);
  };


  // Submissão Final
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.admin_senha.length < 6) {
      return setError('A senha deve ter no mínimo 6 caracteres.');
    }

    if (formData.admin_senha !== formData.admin_senha_confirmacao) {
      return setError('As senhas não coincidem. Digite novamente.');
    }

    setLoading(true);

    const formDataPayload = new FormData();
    formDataPayload.append('tipoPessoa', tipoPessoa);

    // Envia tudo pro action (ignorando o campo de confirmação de senha pois o backend n precisa)
    Object.keys(formData).forEach(key => {
      if (key !== 'admin_senha_confirmacao') {
        formDataPayload.append(key, formData[key]);
      }
    });

    const result = await signUpAction(formDataPayload);

    if (result.error) {
      setError(result.error.message || 'Erro inesperado ao criar a conta.');
      setLoading(false);
    } else {
      router.push('/login?message=Organização criada com sucesso! Verifique seu e-mail para validar o acesso da administração.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6">
        <div className="flex justify-center">
          <img
            src="/marca/logo-elo57-horizontal.svg"
            alt="Logo Elo 57"
            className="h-12 w-auto object-contain"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crie sua Conta no Elo 57
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Gestão centralizada para a construção civil.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden">

          {/* Barra de Progresso Superior */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">

            {/* PASSO 1: Natureza Jurídica */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-8">
                  <h3 className="text-lg font-medium text-gray-900">Qual o seu perfil de negócio?</h3>
                  <p className="text-sm text-gray-500 mt-1">Isso nos ajuda a personalizar sua experiência desde o início.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Card PF */}
                  <div
                    onClick={() => setTipoPessoa('PF')}
                    className={`relative rounded-xl border-2 p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${tipoPessoa === 'PF'
                      ? 'border-blue-600 bg-orange-50/30'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                  >
                    {tipoPessoa === 'PF' && <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-blue-600" />}
                    <div className={`p-3 rounded-full mb-3 ${tipoPessoa === 'PF' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <User className="h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-900">Pessoa Física</h4>
                    <p className="text-xs text-gray-500 mt-1 text-center">Corretores, Autônomos e Empreiteiros</p>
                  </div>

                  {/* Card PJ */}
                  <div
                    onClick={() => setTipoPessoa('PJ')}
                    className={`relative rounded-xl border-2 p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${tipoPessoa === 'PJ'
                      ? 'border-blue-600 bg-orange-50/30'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                  >
                    {tipoPessoa === 'PJ' && <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-blue-600" />}
                    <div className={`p-3 rounded-full mb-3 ${tipoPessoa === 'PJ' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <Building2 className="h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-900">Pessoa Jurídica</h4>
                    <p className="text-xs text-gray-500 mt-1 text-center">Incorporadoras, Construtoras e Imobiliárias</p>
                  </div>
                </div>
              </div>
            )}

            {/* PASSO 2: Dados da Entidade */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5">

                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    {tipoPessoa === 'PJ' ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {tipoPessoa === 'PJ' ? 'Dados da Empresa' : 'Seus Dados Pessoais'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {tipoPessoa === 'PJ' ? 'A base do seu Workspace no Elo 57.' : 'Conta como Profissional Autônomo.'}
                    </p>
                  </div>
                </div>

                {/* Bloco Pessoa Jurídica */}
                {tipoPessoa === 'PJ' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">CNPJ</label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <IMaskInput
                          mask="00.000.000/0000-00"
                          name="cnpj"
                          value={formData.cnpj}
                          unmask={true}
                          onAccept={(value) => updateFormDirectly('cnpj', value)}
                          className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="00.000.000/0000-00"
                        />
                        <button
                          type="button"
                          disabled={!isCnpjValid || buscandoCNPJ}
                          onClick={handleBuscarCNPJ}
                          className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {buscandoCNPJ ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : 'Buscar'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Razão Social *</label>
                        <input
                          type="text"
                          name="razao_social"
                          value={formData.razao_social}
                          onChange={updateForm}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Nome jurídico da empresa"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Nome Fantasia</label>
                        <input
                          type="text"
                          name="nome_fantasia"
                          value={formData.nome_fantasia}
                          onChange={updateForm}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Como a empresa é conhecida"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Bloco Pessoa Física */}
                {tipoPessoa === 'PF' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">CPF</label>
                      <IMaskInput
                        mask="000.000.000-00"
                        name="cpf"
                        value={formData.cpf}
                        unmask={true}
                        onAccept={(value) => updateFormDirectly('cpf', value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nome Completo *</label>
                      <input
                        type="text"
                        name="admin_nome" // Reaproveita para o Workspace Name
                        value={formData.admin_nome}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Seu nome completo"
                      />
                    </div>
                  </>
                )}

                {/* Endereço Unificado (PF ou PJ) */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Endereço Principal</h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700">CEP</label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <IMaskInput
                          mask="00000-000"
                          name="cep"
                          value={formData.cep}
                          unmask={true}
                          onAccept={(value) => updateFormDirectly('cep', value)}
                          onBlur={handleBuscarCEP}
                          className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="00000-000"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-gray-700">Logradouro / Rua</label>
                      <input
                        type="text"
                        name="address_street"
                        value={formData.address_street}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700">Número</label>
                      <input
                        type="text"
                        name="address_number"
                        value={formData.address_number}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-gray-700">Complemento</label>
                      <input
                        type="text"
                        name="address_complement"
                        value={formData.address_complement}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Apto, Bloco, etc."
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-700">Bairro</label>
                      <input
                        type="text"
                        name="neighborhood"
                        value={formData.neighborhood}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700">Cidade</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-700">UF</label>
                      <input
                        type="text"
                        name="state"
                        maxLength="2"
                        value={formData.state}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm uppercase"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* PASSO 3: Acesso Administrador */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                    <Factory className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Acesso Administrativo
                    </h3>
                    <p className="text-sm text-gray-500">
                      Defina os dados de quem irá administrar a plataforma.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {tipoPessoa === 'PJ' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Seu Nome Completo (Admin)</label>
                      <input
                        type="text"
                        name="admin_nome"
                        required
                        value={formData.admin_nome}
                        onChange={updateForm}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Ex: João Silva"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Celular / WhatsApp</label>
                    <IMaskInput
                      mask="(00) 00000-0000"
                      name="admin_telefone"
                      required
                      value={formData.admin_telefone}
                      unmask={true}
                      onAccept={(value) => updateFormDirectly('admin_telefone', value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">E-mail de Acesso</label>
                    <input
                      type="email"
                      name="admin_email"
                      required
                      value={formData.admin_email}
                      onChange={updateForm}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="voce@empresa.com.br"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700">Senha</label>
                      <input
                        type="password"
                        name="admin_senha"
                        required
                        minLength="6"
                        value={formData.admin_senha}
                        onChange={updateForm}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm focus:outline-none focus:ring-2 ${formData.admin_senha.length >= 6
                            ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                            : formData.admin_senha.length > 0
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                          }`}
                        placeholder="Mínimo 6 caracteres"
                      />
                      {formData.admin_senha.length >= 6 && (
                        <CheckCircle2 className="absolute right-3 top-8 h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700">Confirme a Senha</label>
                      <input
                        type="password"
                        name="admin_senha_confirmacao"
                        required
                        minLength="6"
                        value={formData.admin_senha_confirmacao}
                        onChange={updateForm}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm focus:outline-none focus:ring-2 ${formData.admin_senha_confirmacao.length > 0 && formData.admin_senha === formData.admin_senha_confirmacao && formData.admin_senha.length >= 6
                            ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                            : formData.admin_senha_confirmacao.length > 0
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                          }`}
                        placeholder="Repita a senha"
                      />
                      {formData.admin_senha_confirmacao.length > 0 && formData.admin_senha === formData.admin_senha_confirmacao && formData.admin_senha.length >= 6 && (
                        <CheckCircle2 className="absolute right-3 top-8 h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Controle de Erros Geral */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 animate-in fade-in">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {/* Controles do Wizard */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-100 mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </button>
              ) : (
                <div></div> // Spacer para manter o botão "Próximo" na direita
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent hover:bg-blue-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Próximo <ChevronRight className="ml-2 h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent hover:bg-blue-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all w-full sm:w-auto"
                >
                  {loading ? (
                    <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Finalizando Cadastro...</>
                  ) : (
                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Criar a minha Conta</>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Já tem uma conta no Elo 57?{' '}
          <a href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
            Fazer login
          </a>
        </p>
      </div>
    </div>
  );
}