// app/cadastro/page.js

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, User, ChevronRight, ChevronLeft, CheckCircle2, Factory, Loader2 } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { signUpAction, validarCupomAction, verificarCnpjStatusAction } from './actions';
import { buscarCNPJ, buscarCEP } from '@/utils/apiConsultas';

function CadastroForm() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const planParam = searchParams.get('plan') || 'essencial';
 const cupomParam = searchParams.get('cupom') || searchParams.get('coupon') || '';

 // Estados do Wizard
 const [step, setStep] = useState(1);
 const [tipoPessoa, setTipoPessoa] = useState(null); // 'PF' ou 'PJ'
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [pendingCnpjData, setPendingCnpjData] = useState(null);

 // Estados da Assinatura (Passo 4)
 const [selectedPlan, setSelectedPlan] = useState(planParam);
 const [couponCode, setCouponCode] = useState(cupomParam);
 const [couponDiscount, setCouponDiscount] = useState(0);
 const [couponTrialDays, setCouponTrialDays] = useState(15);
 const [validatingCoupon, setValidatingCoupon] = useState(false);
 const [couponMessage, setCouponMessage] = useState('');
 const [periodicidade, setPeriodicidade] = useState('anual'); // 'semestral' ou 'anual'
 const [selectedInstallments, setSelectedInstallments] = useState(6);

 useEffect(() => {
   setSelectedInstallments(periodicidade === 'semestral' ? 3 : 6);
 }, [periodicidade]);

 // Estados de Busca Externa
 const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
 const [buscandoCEP, setBuscandoCEP] = useState(false);
 const [ignorePendingCnpj, setIgnorePendingCnpj] = useState(false);

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
 if (name === 'cnpj') setIgnorePendingCnpj(false);
 setFormData((prev) => ({ ...prev, [name]: value }));
 };

 const updateFormDirectly = (name, value) => {
 if (name === 'cnpj') setIgnorePendingCnpj(false);
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

 // Validação Passo 3
 if (step === 3) {
   if (tipoPessoa === 'PJ' && !formData.admin_nome.trim()) {
     return setError('O Nome Completo do Administrador é obrigatório.');
   }
   if (!formData.admin_telefone.trim()) {
     return setError('O Celular/WhatsApp é obrigatório.');
   }
   if (!formData.admin_email.trim()) {
     return setError('O E-mail de Acesso é obrigatório.');
   }
   if (formData.admin_senha.length < 6) {
     return setError('A senha deve ter no mínimo 6 caracteres.');
   }
   if (formData.admin_senha !== formData.admin_senha_confirmacao) {
     return setError('As senhas não coincidem.');
   }
 }

 setStep(step + 1);
 };

 const prevStep = () => {
 setError('');
 setStep(step - 1);
 };

 const handleApplyCoupon = async (codeToApply = couponCode) => {
   if (!codeToApply.trim()) return;
   setValidatingCoupon(true);
   setCouponMessage('');
   try {
     const result = await validarCupomAction(codeToApply);
     if (result.error) {
       setCouponDiscount(0);
       setCouponTrialDays(15);
       setCouponMessage(`❌ ${result.error}`);
     } else if (result.success) {
       setCouponDiscount(result.desconto_percentual);
       setCouponTrialDays(result.trial_days);
       setCouponMessage(`✅ Cupom aplicado! ${result.desconto_percentual}% de desconto + ${result.trial_days} dias de carência.`);
     }
   } catch (err) {
     setCouponMessage('❌ Erro de conexão ao aplicar cupom.');
   } finally {
     setValidatingCoupon(false);
   }
 };

 useEffect(() => {
   if (cupomParam) {
     handleApplyCoupon(cupomParam);
   }
 }, [cupomParam]);

 const planPrices = {
   essencial: 127.00,
   pro: 297.00,
   ia: 497.00
 };

 const planNames = {
   essencial: 'Elo Essencial',
   pro: 'Elo Pro',
   ia: 'Elo IA'
 };

  const valorMensalBase = planPrices[selectedPlan] || 127.00;
  const meses = periodicidade === 'semestral' ? 6 : 12;
  const parcelasMax = periodicidade === 'semestral' ? 3 : 6;
  const basePriceTotal = valorMensalBase * meses;
  const discountValueTotal = basePriceTotal * (couponDiscount / 100);
  const finalPriceTotal = basePriceTotal - discountValueTotal;
  const valorParcela = finalPriceTotal / selectedInstallments;

 const calculateFirstPaymentDate = () => {
   const d = new Date();
   d.setDate(d.getDate() + couponTrialDays);
   return d.toLocaleDateString('pt-BR');
 };

 // Buscas Externas
 const handleBuscarCNPJ = async () => {
  if (!isCnpjValid || buscandoCNPJ) return;
  setBuscandoCNPJ(true);
  setError('');
  setPendingCnpjData(null);

  // 1. Verificar se CNPJ já existe no banco e qual o status dele (se não estivermos ignorando)
  if (!ignorePendingCnpj) {
    try {
      const statusRes = await verificarCnpjStatusAction(formData.cnpj);
      if (statusRes.error) {
        setError(statusRes.error);
        setBuscandoCNPJ(false);
        return;
      }
      if (statusRes.exists) {
        if (statusRes.status === 'pending') {
          setPendingCnpjData(statusRes);
          setBuscandoCNPJ(false);
          return;
        } else {
          setError('Este CNPJ já está cadastrado em uma conta ativa. Por favor, realize o login.');
          setFormData(prev => ({ ...prev, cnpj: '' }));
          setBuscandoCNPJ(false);
          return;
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status do CNPJ no banco:", err);
    }
  }

  // 2. Se não existir ou se ignorado, busca os dados da Receita Federal
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

 if (step < 4) {
   nextStep();
   return;
 }

 if (formData.admin_senha.length < 6) {
 return setError('A senha deve ter no mínimo 6 caracteres.');
 }

 if (formData.admin_senha !== formData.admin_senha_confirmacao) {
 return setError('As senhas não coincidem. Digite novamente.');
 }

 setLoading(true);

 const formDataPayload = new FormData();
 formDataPayload.append('tipoPessoa', tipoPessoa);
 formDataPayload.append('plano_codigo', selectedPlan);
 formDataPayload.append('cupom', couponCode);
 formDataPayload.append('periodicidade', periodicidade);
 formDataPayload.append('parcelas', String(selectedInstallments));

 // Envia tudo pro action (ignorando o campo de confirmação de senha pois o backend n precisa)
 Object.keys(formData).forEach(key => {
 if (key !== 'admin_senha_confirmacao') {
 formDataPayload.append(key, formData[key]);
 }
 });

 try {
    const result = await signUpAction(formDataPayload);

    if (result.error) {
      const msg = result.error.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('ja cadastrado')) {
        setError(
          <span>
            Este e-mail já está cadastrado.{' '}
            <a href="/login" className="underline font-bold text-red-900 hover:text-red-800">
              Clique aqui para fazer login e concluir sua assinatura.
            </a>
          </span>
        );
      } else {
        setError(msg || 'Erro inesperado ao criar a conta.');
      }
      setLoading(false);
    } else if (result.paymentUrl) {
      window.location.href = result.paymentUrl;
    } else {
      router.push('/login?message=Organização criada com sucesso! Verifique seu e-mail para validar o acesso da administração.');
    }
  } catch (err) {
    console.error("Erro ao enviar cadastro:", err);
    setError("Erro de conexão ou faturamento. Por favor, tente novamente.");
    setLoading(false);
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
 style={{ width: `${(step / 4) * 100}%` }}
 />
 </div>

  <form 
    onSubmit={handleSubmit} 
    onKeyDown={(e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }} 
    className="space-y-6 mt-4"
  >

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
 ? 'border-blue-600 bg-blue-600/30'
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
 ? 'border-blue-600 bg-blue-600/30'
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

  {pendingCnpjData ? (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 my-4">
      <div className="flex justify-center text-blue-500">
        <Building2 className="h-12 w-12" />
      </div>
      <h3 className="font-bold text-slate-800 text-lg">Cadastro em Andamento!</h3>
      <p className="text-sm text-slate-600 leading-relaxed">
        Constatamos que a empresa <strong>{pendingCnpjData.razao_social}</strong> já possui um pré-cadastro em andamento vinculado ao e-mail <strong>{pendingCnpjData.email}</strong>.
      </p>
      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
        {pendingCnpjData.checkoutUrl ? (
          <a
            href={pendingCnpjData.checkoutUrl}
            className="inline-flex justify-center items-center px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all"
          >
            💳 Concluir Assinatura no Asaas
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIgnorePendingCnpj(true);
              setPendingCnpjData(null);
            }}
            className="inline-flex justify-center items-center px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all"
          >
            🔄 Continuar Cadastro do Zero
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (pendingCnpjData.empresaDetails) {
              setFormData(prev => ({
                ...prev,
                razao_social: pendingCnpjData.empresaDetails.razao_social || '',
                nome_fantasia: pendingCnpjData.empresaDetails.nome_fantasia || '',
                cep: pendingCnpjData.empresaDetails.cep || '',
                address_street: pendingCnpjData.empresaDetails.address_street || '',
                address_number: pendingCnpjData.empresaDetails.address_number || '',
                address_complement: pendingCnpjData.empresaDetails.address_complement || '',
                neighborhood: pendingCnpjData.empresaDetails.neighborhood || '',
                city: pendingCnpjData.empresaDetails.city || '',
                state: pendingCnpjData.empresaDetails.state || '',
              }));
            }
            setIgnorePendingCnpj(true);
            setPendingCnpjData(null);
          }}
          className="inline-flex justify-center items-center px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
        >
          Refazer Cadastro do Zero
        </button>
      </div>
    </div>
  ) : (
    <>
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
      required
      value={formData.razao_social}
      onChange={updateForm}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
      />
      </div>
      </div>
      </>
      )}

      {/* Bloco Pessoa Física */}
      {tipoPessoa === 'PF' && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
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
      </div>
      )}

      {/* Bloco de Endereço (Comum a PF/PJ) */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Endereço de Faturamento</h4>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
      <label className="block text-xs font-medium text-gray-700">CEP</label>
      <div className="mt-1 flex rounded-md shadow-sm">
      <IMaskInput
      mask="00000-000"
      name="cep"
      value={formData.cep}
      unmask={true}
      onAccept={(value) => updateFormDirectly('cep', value)}
      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      placeholder="00000-000"
      />
      <button
      type="button"
      disabled={!isCepValid || buscandoCEP}
      onClick={handleBuscarCEP}
      className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
      {buscandoCEP ? <Loader2 className="h-4.5 w-4.5 animate-spin text-blue-600" /> : 'Buscar'}
      </button>
      </div>
      </div>

      <div className="sm:col-span-2">
      <label className="block text-xs font-medium text-gray-700">Logradouro / Rua</label>
      <input
      type="text"
      name="address_street"
      value={formData.address_street}
      onChange={updateForm}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
      </div>

      <div>
      <label className="block text-xs font-medium text-gray-700">Número</label>
      <input
      type="text"
      name="address_number"
      value={formData.address_number}
      onChange={updateForm}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
      </div>

      <div className="sm:col-span-2">
      <label className="block text-xs font-medium text-gray-700">Complemento</label>
      <input
      type="text"
      name="address_complement"
      value={formData.address_complement}
      onChange={updateForm}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      placeholder="Ex: Sala 204, Bloco B"
      />
      </div>

      <div>
      <label className="block text-xs font-medium text-gray-700">Bairro</label>
      <input
      type="text"
      name="neighborhood"
      value={formData.neighborhood}
      onChange={updateForm}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
      </div>

      <div className="sm:col-span-1">
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
    </>
  )}

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

 {/* PASSO 4: Escolha de Plano & Cupom */}
 {step === 4 && (
   <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
     <div className="text-center mb-4">
       <h3 className="text-lg font-semibold text-gray-900">Escolha o seu Plano & Benefícios</h3>
       <p className="text-sm text-gray-500 mt-1">Selecione o plano ideal e confirme seus dados para faturamento.</p>
     </div>

     {/* Seletor de Periodicidade (Tabs) */}
     <div className="flex justify-center">
       <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
         <button
           type="button"
           onClick={() => setPeriodicidade('semestral')}
           className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${periodicidade === 'semestral' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
         >
           Semestral (6 meses)
         </button>
         <button
           type="button"
           onClick={() => setPeriodicidade('anual')}
           className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${periodicidade === 'anual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
         >
           Anual (12 meses)
         </button>
       </div>
     </div>

     {/* Seleção de Planos (3 Cards) */}
     <div className="space-y-3">
       {/* Plano Essencial */}
       <div
         onClick={() => setSelectedPlan('essencial')}
         className={`relative rounded-xl border-2 p-4 cursor-pointer text-left transition-all duration-200 ${selectedPlan === 'essencial'
         ? 'border-blue-600 bg-blue-50/40 shadow-sm'
         : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
         }`}
       >
         <div className="flex justify-between items-center mb-1">
           <h4 className="text-sm font-bold text-gray-900">Elo Essencial</h4>
           <span className="text-xs font-extrabold text-blue-600">R$ 127/mês (Total: R$ {periodicidade === 'semestral' ? '762' : '1.524'})</span>
         </div>
         <p className="text-xs text-gray-500">Operação básica de obras, financeiro centralizado e contratos.</p>
       </div>

       {/* Plano Pro */}
       <div
         onClick={() => setSelectedPlan('pro')}
         className={`relative rounded-xl border-2 p-4 cursor-pointer text-left transition-all duration-200 ${selectedPlan === 'pro'
         ? 'border-blue-600 bg-blue-50/40 shadow-sm'
         : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
         }`}
       >
         <div className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full shadow-xs">
           Mais Recomendado
         </div>
         <div className="flex justify-between items-center mb-1">
           <h4 className="text-sm font-bold text-gray-900">Elo Pro</h4>
           <span className="text-xs font-extrabold text-blue-600">R$ 297/mês (Total: R$ {periodicidade === 'semestral' ? '1.782' : '3.564'})</span>
         </div>
         <p className="text-xs text-gray-500">BIM 3D, CRM completo, Almoxarifado, Pedidos, Diário de Obra e RH.</p>
       </div>

       {/* Plano Elo IA */}
       <div
         onClick={() => setSelectedPlan('ia')}
         className={`relative rounded-xl border-2 p-4 cursor-pointer text-left transition-all duration-200 ${selectedPlan === 'ia'
         ? 'border-blue-600 bg-blue-50/40 shadow-sm'
         : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
         }`}
       >
         <div className="flex justify-between items-center mb-1">
           <h4 className="text-sm font-bold text-gray-900">Elo IA</h4>
           <span className="text-xs font-extrabold text-blue-600">R$ 497/mês (Total: R$ {periodicidade === 'semestral' ? '2.982' : '5.964'})</span>
         </div>
         <p className="text-xs text-gray-500">Completo (Pro) + Automação de WhatsApp e qualificação da Stella IA.</p>
       </div>
     </div>

     {/* Input de Cupom */}
     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left">
       <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cupom de Desconto / Trial</label>
       <div className="flex gap-2">
         <input
           type="text"
           value={couponCode}
           onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
           placeholder="Digite o cupom (Ex: AMIGODODONO)"
           className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs uppercase focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
         />
         <button
           type="button"
           onClick={() => handleApplyCoupon()}
           disabled={validatingCoupon}
           className="px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
         >
           {validatingCoupon ? 'Validando...' : 'Aplicar'}
         </button>
       </div>
       {couponMessage && (
         <p className={`text-[11px] font-semibold mt-2 ${couponMessage.startsWith('❌') ? 'text-red-600' : 'text-emerald-700'}`}>
           {couponMessage}
         </p>
       )}
     </div>

     {/* Resumo Financeiro */}
     <div className="bg-blue-50/30 border border-blue-100 p-4 rounded-xl space-y-2 text-left">
       <h4 className="font-bold text-blue-800 uppercase tracking-wider text-[10px]">Detalhamento da Assinatura</h4>
       <div className="text-xs space-y-1 text-slate-700">
         <div className="flex justify-between">
           <span>Valor do Plano ({planNames[selectedPlan]} - {periodicidade === 'semestral' ? 'Semestral' : 'Anual'}):</span>
           <span>R$ {basePriceTotal.toFixed(2).replace('.', ',')}</span>
         </div>
         {couponDiscount > 0 && (
           <div className="flex justify-between text-emerald-700 font-medium">
             <span>Desconto do Cupom ({couponDiscount}%):</span>
             <span>- R$ {discountValueTotal.toFixed(2).replace('.', ',')}</span>
           </div>
         )}
         <div className="flex justify-between font-bold text-sm text-slate-900 pt-1.5 border-t border-blue-100/60">
           <span>Valor Líquido Total:</span>
           <span>R$ {finalPriceTotal.toFixed(2).replace('.', ',')}</span>
         </div>
          {couponDiscount > 0 ? (
            <div className="flex justify-between text-[11px] text-slate-500 font-medium pt-0.5">
              <span>Opção de parcelamento no cartão:</span>
              <span>Até {parcelasMax}x de R$ {valorParcela.toFixed(2).replace('.', ',')}</span>
            </div>
          ) : (
            <div className="flex justify-between items-center text-[11px] text-slate-700 font-medium pt-1.5 border-t border-dashed border-blue-100 mt-1">
              <span>Opção de parcelamento:</span>
              <select
                value={selectedInstallments}
                onChange={(e) => setSelectedInstallments(Number(e.target.value))}
                className="border border-blue-200 rounded px-1.5 py-0.5 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800"
              >
                {Array.from({ length: parcelasMax }, (_, i) => i + 1).map((num) => {
                  const parcelVal = Number((finalPriceTotal / num).toFixed(2));
                  return (
                    <option key={num} value={num}>
                      {num === 1 
                        ? `1x de R$ ${parcelVal.toFixed(2).replace('.', ',')} (À vista no Pix, Boleto ou Cartão)`
                        : `${num}x de R$ ${parcelVal.toFixed(2).replace('.', ',')} sem juros (Apenas Cartão)`
                      }
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
       
       {couponDiscount > 0 ? (
         <div className="text-[11px] text-emerald-800 bg-emerald-100/40 p-2.5 rounded-lg font-medium leading-relaxed mt-2">
           🎁 <strong>{couponTrialDays} dias de carência incluídos!</strong> O seu cartão de crédito será cadastrado apenas como **garantia** (R$ 0,00 cobrado hoje). O faturamento ocorrerá somente em {calculateFirstPaymentDate()}, quando você poderá confirmar e parcelar a compra.
         </div>
       ) : (
         <div className="text-[11px] text-blue-800 bg-blue-100/40 p-2.5 rounded-lg font-medium leading-relaxed mt-2">
           💳 <strong>Faturamento imediato via Asaas!</strong> Você poderá parcelar em até {parcelasMax}x sem juros no cartão de crédito, ou pagar à vista via PIX/Boleto no ambiente seguro do Asaas. Seu acesso será liberado assim que o pagamento for detectado.
         </div>
       )}
     </div>

    {/* Resumo Cadastral */}
    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-left">
      <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-2.5">Dados da Empresa / Profissional</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-600">
        <div><strong className="text-slate-700">Nome:</strong> {tipoPessoa === 'PJ' ? formData.razao_social : formData.admin_nome}</div>
        <div><strong className="text-slate-700">Documento:</strong> {tipoPessoa === 'PJ' ? formData.cnpj : formData.cpf}</div>
        <div><strong className="text-slate-700">Responsável:</strong> {formData.admin_nome}</div>
        <div><strong className="text-slate-700">WhatsApp:</strong> {formData.admin_telefone}</div>
        <div className="sm:col-span-2"><strong className="text-slate-700">Endereço:</strong> {formData.address_street}, {formData.address_number} - {formData.city}/{formData.state} (CEP: {formData.cep})</div>
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
 {!pendingCnpjData && (
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

  {step < 4 ? (
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
  <><CheckCircle2 className="mr-2 h-4 w-4" /> Ir para Checkout Seguro (Asaas)</>
  )}
  </button>
  )}
  </div>
  )}

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

export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    }>
      <CadastroForm />
    </Suspense>
  );
}