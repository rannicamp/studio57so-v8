// app/cadastro/page.js

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, User, ChevronRight, ChevronLeft, CheckCircle2, Factory, Loader2, CreditCard, QrCode, ClipboardCheck } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { signUpAction, validarCupomAction, verificarDocumentoStatusAction, solicitarCodigoVerificacaoAction, validarCodigoVerificacaoAction } from './actions';
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

 // Estados da Assinatura (Passo 4)
 const [selectedPlan, setSelectedPlan] = useState(planParam);
 const [couponCode, setCouponCode] = useState(cupomParam);
 const [couponDiscount, setCouponDiscount] = useState(0);
 const [couponTrialDays, setCouponTrialDays] = useState(15);
 const [validatingCoupon, setValidatingCoupon] = useState(false);
 const [couponMessage, setCouponMessage] = useState('');
 const [periodicidade, setPeriodicidade] = useState('anual'); // 'semestral' ou 'anual'
 const [selectedInstallments, setSelectedInstallments] = useState(6);

 // Estados de Pós-Cadastro (Tela de Transição / Resposta)
 const [cadastroSucesso, setCadastroSucesso] = useState(false);
 const [paymentUrl, setPaymentUrl] = useState('');
 const [pixQrCode, setPixQrCode] = useState('');
 const [pixCopiaCola, setPixCopiaCola] = useState('');
 const [formaPagamentoEscolhida, setFormaPagamentoEscolhida] = useState('cartao');
 const [copiouPix, setCopiouPix] = useState(false);
 const [otpCodigoDigitado, setOtpCodigoDigitado] = useState('');
 const [otpToken, setOtpToken] = useState('');
 const [loadingOtp, setLoadingOtp] = useState(false);
 const [otpEnviadoMensagem, setOtpEnviadoMensagem] = useState('');
 const [aceitouTermos, setAceitouTermos] = useState(false);

 useEffect(() => {
   setSelectedInstallments(periodicidade === 'semestral' ? 3 : 6);
 }, [periodicidade]);

  // Modo Debug / Atalho para testes
  useEffect(() => {
    const devStep = searchParams.get('devStep');
    if (devStep) {
      const stepNum = parseInt(devStep, 10);
      if (stepNum >= 1 && stepNum <= 6) {
        setStep(stepNum);
        setFormData(prev => ({
          ...prev,
          cnpj: '48.152.345/0001-97',
          razao_social: 'Studio 57 Empreendimentos Ltda',
          nome_fantasia: 'Studio 57',
          cpf: '',
          cep: '35162-000',
          address_street: 'Avenida Brasil',
          address_number: '120',
          address_complement: '',
          neighborhood: 'Centro',
          city: 'Ipatinga',
          state: 'MG',
          admin_nome: 'Ranniere Campos',
          admin_email: 'rannierecampos1@gmail.com',
          admin_telefone: '33991912291',
          admin_senha: 'SenhaDeTeste123@',
          admin_senha_confirmacao: 'SenhaDeTeste123@'
        }));
        setTipoPessoa('PJ');
      }
    }

    const devSuccess = searchParams.get('devSuccess');
    if (devSuccess) {
      setCadastroSucesso(true);
      setFormaPagamentoEscolhida(devSuccess === 'pix' ? 'pix' : 'cartao');
      if (devSuccess === 'pix') {
        setPixQrCode('iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABZ0RVh0Q3JlYXRpb24gVGltZQAwOC8wNy8yNlq24D4AAAB1SURBVHic7cEBDQAAAMKg909tDjcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADuxZgAB4Es3QAAAAABJRU5ErkJggg==');
        setPixCopiaCola('00020101021226870014br.gov.bcb.pix2565qr-code-teste-asaas-elo57-studio55339919122915204000053039865802BR5925Studio 57 Incorporadora6009IPATINGA62070503***6304ABCD');
      }
    }
  }, [searchParams]);

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

 // Dados de Faturamento Transparente (Passo 5)
 forma_pagamento: 'cartao', // 'cartao' ou 'pix'
 cartao_numero: '',
 cartao_nome: '',
 cartao_validade: '',
 cartao_cvv: '',
 });

 const updateForm = (e) => {
 const { name, value } = e.target;
 setFormData((prev) => ({ ...prev, [name]: value }));
 };

 const updateFormDirectly = (name, value) => {
 setFormData((prev) => ({ ...prev, [name]: value }));
 }

 // Se houver trial/carência ativo pelo cupom, a forma de pagamento DEVE ser cartão (garantia)
 useEffect(() => {
   if (couponDiscount > 0 && couponTrialDays > 0) {
     setFormData(prev => ({ ...prev, forma_pagamento: 'cartao' }));
   }
 }, [couponDiscount, couponTrialDays]);

  // Máscaras e Validadores
  const isCnpjValid = (formData.cnpj || '').replace(/\D/g, '').length === 14;
  const isCpfValid = (formData.cpf || '').replace(/\D/g, '').length === 11;
  const isCepValid = (formData.cep || '').replace(/\D/g, '').length === 8;

 // Navegação
  const nextStep = async () => {
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

    // Validação Passo 3 -> Envia OTP
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

      setLoadingOtp(true);
      setError('');
      try {
        const res = await solicitarCodigoVerificacaoAction(formData.admin_email);
        if (res.error) {
          setError(res.error);
          setLoadingOtp(false);
          return;
        }
        setOtpToken(res.token);
        setOtpEnviadoMensagem(`Enviamos um código de segurança de 6 dígitos para o e-mail ${formData.admin_email}`);
        setStep(4);
      } catch (err) {
        setError('Erro de conexão ao enviar e-mail de confirmação.');
      } finally {
        setLoadingOtp(false);
      }
      return;
    }

    // Validação Passo 4 (OTP) -> Valida OTP
    if (step === 4) {
      if (otpCodigoDigitado.trim().length !== 6) {
        return setError('Digite o código de 6 dígitos enviado para o seu e-mail.');
      }

      setLoadingOtp(true);
      setError('');
      try {
        const res = await validarCodigoVerificacaoAction(formData.admin_email, otpCodigoDigitado, otpToken);
        if (res.error) {
          setError(res.error);
          setLoadingOtp(false);
          return;
        }
        setStep(5);
      } catch (err) {
        setError('Erro ao validar o código. Tente novamente.');
      } finally {
        setLoadingOtp(false);
      }
      return;
    }

    // Passos restantes
    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    if (step === 4) {
      setOtpCodigoDigitado('');
    }
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
    pro: 497.00,
    ia: 797.00
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
  const finalPriceTotal = couponCode === 'ELOTESTE1REAL' ? 6.00 : (basePriceTotal * (1 - couponDiscount / 100));
  const discountValueTotal = basePriceTotal - finalPriceTotal;
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

  try {
    const statusRes = await verificarDocumentoStatusAction(formData.cnpj);
    if (statusRes.error) {
      setError(statusRes.error);
      setBuscandoCNPJ(false);
      return;
    }
    if (statusRes.exists) {
      if (statusRes.status === 'active') {
        setError('Este CNPJ já está cadastrado em uma conta ativa. Por favor, realize o login.');
        setFormData(prev => ({ ...prev, cnpj: '' }));
        setBuscandoCNPJ(false);
        return;
      } else if (statusRes.status === 'pending') {
        if (statusRes.empresaDetails) {
          setFormData(prev => ({
            ...prev,
            razao_social: statusRes.empresaDetails.razao_social || prev.razao_social,
            nome_fantasia: statusRes.empresaDetails.nome_fantasia || prev.nome_fantasia,
            cep: statusRes.empresaDetails.cep || prev.cep,
            address_street: statusRes.empresaDetails.address_street || prev.address_street,
            address_number: statusRes.empresaDetails.address_number || prev.address_number,
            address_complement: statusRes.empresaDetails.address_complement || prev.address_complement,
            neighborhood: statusRes.empresaDetails.neighborhood || prev.neighborhood,
            city: statusRes.empresaDetails.city || prev.city,
            state: statusRes.empresaDetails.state || prev.state,
            admin_telefone: statusRes.empresaDetails.telefone || prev.admin_telefone,
            admin_nome: statusRes.empresaDetails.responsavel_legal || prev.admin_nome,
          }));
        }
        setBuscandoCNPJ(false);
        return;
      }
    }
  } catch (err) {
    console.error("Erro ao verificar status do CNPJ no banco:", err);
  }

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

  const handleBuscarCPF = async () => {
    if (!isCpfValid || buscandoCNPJ) return;
    setBuscandoCNPJ(true);
    setError('');

    try {
      const statusRes = await verificarDocumentoStatusAction(formData.cpf);
      if (statusRes.error) {
        setError(statusRes.error);
        setBuscandoCNPJ(false);
        return;
      }
      if (statusRes.exists) {
        if (statusRes.status === 'active') {
          setError('Este CPF já está cadastrado em uma conta ativa. Por favor, realize o login.');
          setFormData(prev => ({ ...prev, cpf: '' }));
          setBuscandoCNPJ(false);
          return;
        } else if (statusRes.status === 'pending') {
          if (statusRes.empresaDetails) {
            setFormData(prev => ({
              ...prev,
              admin_nome: statusRes.empresaDetails.razao_social || prev.admin_nome,
              cep: statusRes.empresaDetails.cep || prev.cep,
              address_street: statusRes.empresaDetails.address_street || prev.address_street,
              address_number: statusRes.empresaDetails.address_number || prev.address_number,
              address_complement: statusRes.empresaDetails.address_complement || prev.address_complement,
              neighborhood: statusRes.empresaDetails.neighborhood || prev.neighborhood,
              city: statusRes.empresaDetails.city || prev.city,
              state: statusRes.empresaDetails.state || prev.state,
              admin_telefone: statusRes.empresaDetails.telefone || prev.admin_telefone,
            }));
          }
          setBuscandoCNPJ(false);
          return;
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status do CPF no banco:", err);
    }
    setBuscandoCNPJ(false);
  };

  useEffect(() => {
    if (tipoPessoa === 'PF' && isCpfValid) {
      handleBuscarCPF();
    }
  }, [formData.cpf, tipoPessoa]);

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

 const handleCopiarPix = () => {
   if (!pixCopiaCola) return;
   navigator.clipboard.writeText(pixCopiaCola);
   setCopiouPix(true);
   setTimeout(() => setCopiouPix(false), 2000);
 };

 // Submissão Final (Checkout Transparente)
 const handleSubmit = async (e) => {
   if (e && e.preventDefault) e.preventDefault();
   setError('');

   if (step < 5) {
     nextStep();
     return;
   }

   // Validar dados do cartão se escolhido
   if (formData.forma_pagamento === 'cartao') {
     const numClean = formData.cartao_numero.replace(/\D/g, '');
     if (!numClean) return setError('O número do cartão de crédito é obrigatório.');
     if (numClean.length < 13) return setError('Número de cartão de crédito inválido ou incompleto.');
     if (!formData.cartao_nome.trim()) return setError('Nome do titular do cartão é obrigatório.');
     if (!formData.cartao_validade.trim()) return setError('Validade do cartão (MM/AA) é obrigatória.');
     if (formData.cartao_validade.length < 4) return setError('Validade incorreta. Use o formato MM/AA.');
     
     const cvvClean = formData.cartao_cvv.replace(/\D/g, '');
     if (!cvvClean) return setError('O código de segurança (CVV) é obrigatório.');
     if (cvvClean.length < 3) return setError('CVV deve conter no mínimo 3 dígitos.');
   }

   setLoading(true);

   const formDataPayload = new FormData();
   formDataPayload.append('tipoPessoa', tipoPessoa);
   formDataPayload.append('plano_codigo', selectedPlan);
   formDataPayload.append('cupom', couponCode);
   formDataPayload.append('periodicidade', periodicidade);
   formDataPayload.append('parcelas', String(selectedInstallments));

   // Envia todo o formData
   Object.keys(formData).forEach(key => {
     if (key !== 'admin_senha_confirmacao') {
       formDataPayload.append(key, formData[key]);
     }
   });

   try {
     const result = await signUpAction(formDataPayload);

     if (result.error) {
       setError(result.error.message || 'Erro ao processar o seu faturamento no Asaas. Verifique os dados digitados.');
       setLoading(false);
     } else if (result.success) {
       setPaymentUrl(result.paymentUrl || '');
       setPixQrCode(result.pixQrCode || '');
       setPixCopiaCola(result.pixCopiaCola || '');
       setFormaPagamentoEscolhida(result.formaPagamento || 'cartao');
       
       // Limpar dados do cartão do estado React por segurança
       setFormData(prev => ({
         ...prev,
         cartao_numero: '',
         cartao_nome: '',
         cartao_validade: '',
         cartao_cvv: ''
       }));

       setCadastroSucesso(true);
       setLoading(false);
     } else {
       router.push('/login?message=Conta criada com sucesso! Efetue seu login para acessar.');
     }
   } catch (err) {
     console.error("Erro no fluxo de checkout transparente:", err);
     setError("Erro de conexão ou processamento. Por favor, revise seus dados e tente novamente.");
     setLoading(false);
   }
 };

 // Tela Final de Cadastro Concluído (Sem sair do Elo 57)
 if (cadastroSucesso) {
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
          {formaPagamentoEscolhida === 'pix' ? 'Aguardando Pagamento... ⚡' : 'Cadastro Concluído! 🎉'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {formaPagamentoEscolhida === 'pix' 
            ? 'Sua conta foi reservada. Conclua o PIX para liberar o acesso.' 
            : 'Seu faturamento seguro foi processado com sucesso.'}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100 space-y-6 text-center">
          
          {formaPagamentoEscolhida === 'pix' ? (
            <div className="space-y-5 flex flex-col items-center">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <QrCode className="h-12 w-12" />
              </div>
              
              <div className="text-slate-700 leading-relaxed text-sm space-y-2">
                <p><strong>Acesse o app do seu banco e pague via PIX:</strong></p>
                <p className="text-gray-500 text-xs">
                  Escaneie o QR Code abaixo ou copie a chave copia e cola. A liberação do sistema é instantânea após o pagamento!
                </p>
              </div>

              {pixQrCode && (
                <div className="p-2 border border-gray-200 rounded-2xl bg-white shadow-xs">
                  <img 
                    src={`data:image/png;base64,${pixQrCode}`} 
                    alt="QR Code PIX Asaas" 
                    className="h-44 w-44 object-contain"
                  />
                </div>
              )}

              {pixCopiaCola && (
                <div className="w-full space-y-2">
                  <textarea
                    readOnly
                    value={pixCopiaCola}
                    rows="3"
                    className="w-full text-[10px] font-mono p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-slate-600 focus:outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopiarPix}
                    className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-300 shadow-xs text-xs font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-50 active:scale-98 transition-all"
                  >
                    {copiouPix ? (
                      <><ClipboardCheck className="mr-1.5 h-4 w-4 text-emerald-600" /> Copiado com sucesso!</>
                    ) : (
                      '📋 Copiar Chave PIX Copia e Cola'
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center text-green-500">
                <CheckCircle2 className="h-16 w-16" />
              </div>
              
              <div className="space-y-2 text-slate-700 leading-relaxed text-sm">
                <p>
                  <strong>Seja bem-vindo ao Elo 57!</strong> A transação do cartão de crédito foi autorizada e seu workspace foi liberado para acesso imediato.
                </p>
                {couponDiscount > 0 && (
                  <p className="text-emerald-700 font-semibold text-xs bg-emerald-50 py-1.5 px-3 rounded-lg inline-block">
                    🎁 Período de trial ativo! Primeira cobrança apenas em {calculateFirstPaymentDate()}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Resumo da Compra */}
          <div className="bg-slate-50 border border-slate-200/50 p-5 rounded-xl text-left space-y-2.5 text-xs">
            <h4 className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Resumo do Workspace</h4>
            <div className="space-y-1 text-slate-650 font-light">
              <div><strong className="text-slate-800">Plano Contratado:</strong> {planNames[selectedPlan]}</div>
              <div><strong className="text-slate-800">Vigência:</strong> {periodicidade === 'semestral' ? 'Semestral (6 meses)' : 'Anual (12 meses)'}</div>
              <div><strong className="text-slate-800">Valor Total:</strong> R$ {finalPriceTotal.toFixed(2).replace('.', ',')}</div>
              {formaPagamentoEscolhida === 'cartao' && (
                <div>
                  <strong className="text-slate-800">Condição de Faturamento:</strong> {
                    selectedInstallments === 1 
                      ? 'À vista no Cartão de Crédito' 
                      : `${selectedInstallments}x de R$ ${(finalPriceTotal / selectedInstallments).toFixed(2).replace('.', ',')} sem juros`
                  }
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <a
              href="/login"
              className="inline-flex justify-center items-center px-8 py-3.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-98 w-full uppercase tracking-wider text-center"
            >
              🚀 Fazer Login no Elo 57
            </a>
            
            <button
              type="button"
              onClick={() => setCadastroSucesso(false)}
              className="inline-flex justify-center items-center px-6 py-2.5 text-xs font-semibold text-slate-650 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all active:scale-98 w-full uppercase tracking-wider"
            >
              🔄 Voltar e Alterar Dados de Assinatura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
 }

 return (
 <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
 <div className="sm:mx-auto sm:w-full sm:max-w-md">
 <div className="flex justify-center">
 <img
 src="/marca/logo-elo57-horizontal.svg"
 alt="Logo Elo 57"
 className="h-12 w-auto object-contain"
 />
 </div>
 <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
 Crie sua conta no Elo 57
 </h2>
 <p className="mt-2 text-center text-sm text-gray-600">
 Comece a gerenciar suas obras e financeiro de forma inteligente.
 </p>
 </div>

 <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
 <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
  {/* Indicador de Passos */}
  <div className="mb-8">
    <div className="flex items-center justify-between">
      {[1, 2, 3, 4, 5, 6].map((num) => (
        <div key={num} className="flex items-center">
          <div
            className={`flex items-center justify-center h-8 w-8 rounded-full font-semibold text-sm transition-all duration-300 ${
              step === num
                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : step > num
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {step > num ? '✓' : num}
          </div>
          {num < 6 && (
            <div
              className={`h-1 w-4 sm:w-8 mx-0.5 rounded transition-all duration-300 ${
                step > num ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  </div>

 <form className="space-y-6">
 {/* PASSO 1: Tipo de Conta */}
 {step === 1 && (
 <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4">
 <div className="text-center mb-6">
 <h3 className="text-lg font-medium text-gray-900">Tipo de Assinatura</h3>
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
    <div className="mt-1 flex rounded-md shadow-sm">
    <IMaskInput
    mask="000.000.000-00"
    name="cpf"
    value={formData.cpf}
    unmask={true}
    onAccept={(value) => updateFormDirectly('cpf', value)}
    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
    placeholder="000.000.000-00"
    />
    {buscandoCNPJ && (
      <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      </span>
    )}
    </div>
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

  {/* PASSO 4: Confirmar E-mail (OTP) */}
  {step === 4 && (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
      <div className="text-center mb-4 flex flex-col items-center">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3 animate-pulse">
          <Loader2 className={`h-8 w-8 ${loadingOtp ? 'animate-spin' : ''}`} />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Confirme o seu E-mail</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          {otpEnviadoMensagem || `Enviamos um código de segurança de 6 dígitos para o seu e-mail.`}
        </p>
      </div>

      <div className="max-w-xs mx-auto space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">Código de 6 dígitos</label>
          <IMaskInput
            mask="000000"
            value={otpCodigoDigitado}
            unmask={true}
            onAccept={(value) => setOtpCodigoDigitado(value)}
            className="block w-full text-center px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold tracking-widest bg-white focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            placeholder="000000"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 text-center">
          <button
            type="button"
            disabled={loadingOtp}
            onClick={async () => {
              setLoadingOtp(true);
              setError('');
              try {
                const res = await solicitarCodigoVerificacaoAction(formData.admin_email);
                if (res.error) {
                  setError(res.error);
                } else {
                  setOtpToken(res.token);
                  setOtpEnviadoMensagem(`Código reenviado com sucesso para ${formData.admin_email}!`);
                }
              } catch (err) {
                setError('Erro ao reenviar o código.');
              } finally {
                setLoadingOtp(false);
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold py-1 bg-transparent border-0 cursor-pointer text-center"
          >
            Reenviar Código de Segurança
          </button>
        </div>
      </div>
    </div>
  )}

 {/* PASSO 5: Escolha de Plano & Cupom */}
 {step === 5 && (
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
         <div className="flex justify-between items-start mb-1">
           <div>
             <h4 className="text-sm font-bold text-gray-900">Elo Essencial</h4>
             <p className="text-[10px] text-gray-400 font-medium mt-0.5">+ R$ 50 por usuário</p>
           </div>
           <div className="text-right">
             <span className="text-xs font-extrabold text-blue-600">R$ 127/mês</span>
             <p className="text-[10px] text-gray-500 font-normal mt-0.5">Total: R$ {periodicidade === 'semestral' ? '762' : '1.524'}</p>
           </div>
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
         <div className="flex justify-between items-start mb-1">
           <div>
             <h4 className="text-sm font-bold text-gray-900">Elo Pro</h4>
             <p className="text-[10px] text-gray-400 font-medium mt-0.5">+ R$ 50 por usuário</p>
           </div>
           <div className="text-right">
             <span className="text-xs font-extrabold text-blue-600">R$ 497/mês</span>
             <p className="text-[10px] text-gray-500 font-normal mt-0.5">Total: R$ {periodicidade === 'semestral' ? '2.982' : '5.964'}</p>
           </div>
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
         <div className="flex justify-between items-start mb-1">
           <div>
             <h4 className="text-sm font-bold text-gray-900">Elo IA</h4>
             <p className="text-[10px] text-gray-400 font-medium mt-0.5">+ R$ 50 por usuário</p>
           </div>
           <div className="text-right">
             <span className="text-xs font-extrabold text-blue-600">R$ 797/mês</span>
             <p className="text-[10px] text-gray-500 font-normal mt-0.5">Total: R$ {periodicidade === 'semestral' ? '4.782' : '9.564'}</p>
           </div>
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
           onKeyDown={(e) => {
             if (e.key === 'Enter') {
               e.preventDefault();
               handleApplyCoupon();
             }
           }}
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
   </div>
   )}

 {/* PASSO 6: Faturamento Direto (Checkout Transparente) */}
 {step === 6 && (
   <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5">
     <div className="text-center mb-2">
       <h3 className="text-lg font-semibold text-gray-900">Método de Faturamento Seguro</h3>
       <p className="text-xs text-gray-500 mt-1">Insira os dados para ativação imediata do seu Workspace.</p>
     </div>

     {/* Seletor do Método de Pagamento (Abas) */}
     {couponDiscount > 0 && couponTrialDays > 0 ? (
       <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs leading-relaxed font-medium">
         🎁 <strong>Cupom com {couponTrialDays} dias grátis ativo!</strong> Por regra de segurança e recorrência SaaS, é obrigatório registrar um <strong>Cartão de Crédito como garantia</strong>. O cartão só será faturado ao final do trial (R$ 0,00 cobrado hoje).
       </div>
     ) : (
       <div className="grid grid-cols-2 gap-3 mb-4">
         <div
           onClick={() => updateFormDirectly('forma_pagamento', 'cartao')}
           className={`p-3.5 border-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
             formData.forma_pagamento === 'cartao'
               ? 'border-blue-600 bg-blue-50/40 text-blue-900 font-bold'
               : 'border-gray-200 hover:border-blue-200 text-gray-600 hover:bg-gray-50'
           }`}
         >
           <CreditCard className="h-4 w-4" />
           <span className="text-xs uppercase tracking-wider">Cartão de Crédito</span>
         </div>
         <div
           onClick={() => updateFormDirectly('forma_pagamento', 'pix')}
           className={`p-3.5 border-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
             formData.forma_pagamento === 'pix'
               ? 'border-blue-600 bg-blue-50/40 text-blue-900 font-bold'
               : 'border-gray-200 hover:border-blue-200 text-gray-600 hover:bg-gray-50'
           }`}
         >
           <QrCode className="h-4 w-4" />
           <span className="text-xs uppercase tracking-wider">PIX Copia/Cola</span>
         </div>
       </div>
     )}

     {/* Formulário do Cartão de Crédito */}
     {formData.forma_pagamento === 'cartao' && (
       <div className="space-y-4 bg-slate-50/50 p-4 border border-slate-200/60 rounded-2xl animate-in fade-in duration-300">
         <div>
           <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Número do Cartão</label>
           <IMaskInput
             mask="0000 0000 0000 0000"
             name="cartao_numero"
             value={formData.cartao_numero}
             unmask={true}
             onAccept={(value) => updateFormDirectly('cartao_numero', value)}
             className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
             placeholder="0000 0000 0000 0000"
             autoComplete="off"
           />
         </div>

         <div>
           <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nome Impresso no Cartão</label>
           <input
             type="text"
             name="cartao_nome"
             value={formData.cartao_nome}
             onChange={updateForm}
             className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500 focus:outline-none uppercase"
             placeholder="EX: JOAO S SILVA"
             autoComplete="off"
           />
         </div>

         <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Validade</label>
             <IMaskInput
               mask="00/00"
               name="cartao_validade"
               value={formData.cartao_validade}
               unmask={true}
               onAccept={(value) => updateFormDirectly('cartao_validade', value)}
               className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
               placeholder="MM/AA"
               autoComplete="off"
             />
           </div>
           <div>
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">CVV / Cód. Segurança</label>
             <IMaskInput
               mask="0000"
               name="cartao_cvv"
               value={formData.cartao_cvv}
               unmask={true}
               onAccept={(value) => updateFormDirectly('cartao_cvv', value)}
               className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
               placeholder="123"
               autoComplete="off"
             />
           </div>
         </div>

         {/* Opções de Parcelamento (Se não houver carência/trial) */}
         {couponDiscount > 0 && couponTrialDays > 0 ? (
           <div className="text-[10px] text-emerald-800 font-semibold bg-emerald-50/50 p-2 rounded-lg text-center mt-1 border border-emerald-100">
             💳 R$ 0,00 cobrado hoje. Cobrança de R$ {finalPriceTotal.toFixed(2).replace('.', ',')} apenas em {calculateFirstPaymentDate()}.
           </div>
         ) : (
           <div className="pt-2 border-t border-slate-200/50">
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Condição de Pagamento</label>
             <select
               value={selectedInstallments}
               onChange={(e) => setSelectedInstallments(Number(e.target.value))}
               className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
             >
               {Array.from({ length: parcelasMax }, (_, i) => i + 1).map((num) => {
                 const parcelVal = Number((finalPriceTotal / num).toFixed(2));
                 return (
                   <option key={num} value={num}>
                     {num === 1 
                       ? `1x de R$ ${parcelVal.toFixed(2).replace('.', ',')} (À vista)`
                       : `${num}x de R$ ${parcelVal.toFixed(2).replace('.', ',')} sem juros (No Cartão)`
                     }
                   </option>
                 );
               })}
             </select>
           </div>
         )}
       </div>
     )}

     {/* Detalhes do PIX */}
     {formData.forma_pagamento === 'pix' && (
       <div className="p-5 border border-slate-200/60 rounded-2xl bg-blue-50/20 text-center animate-in fade-in duration-300 space-y-2">
         <div className="flex justify-center text-blue-600 mb-1">
           <QrCode className="h-10 w-10 animate-pulse" />
         </div>
         <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">PIX à Vista no valor de R$ {finalPriceTotal.toFixed(2).replace('.', ',')}</h4>
         <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
           Ao clicar em finalizar abaixo, geraremos a chave PIX e o QR Code de cobrança oficial do Asaas. A compensação é imediata e libera seu acesso ao sistema na hora!
         </p>
       </div>
     )}

     {/* Detalhes do Plano */}
     <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-left space-y-1">
       <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Confirmação de Dados</h4>
       <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-650 font-light">
         <div><strong className="text-slate-700">Plano:</strong> {planNames[selectedPlan]} ({periodicidade === 'semestral' ? 'Semestral' : 'Anual'})</div>
         <div><strong className="text-slate-700">Total Líquido:</strong> R$ {finalPriceTotal.toFixed(2).replace('.', ',')}</div>
         <div><strong className="text-slate-700">Documento:</strong> {tipoPessoa === 'PJ' ? formData.cnpj : formData.cpf}</div>
         <div><strong className="text-slate-700">Nome:</strong> {tipoPessoa === 'PJ' ? formData.razao_social : formData.admin_nome}</div>
       </div>
     </div>

      {/* Aceite de Termos de Uso */}
      <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl text-left select-none hover:bg-slate-105/10 transition-colors cursor-pointer" onClick={() => setAceitouTermos(!aceitouTermos)}>
        <input
          id="aceitou_termos_checkbox"
          type="checkbox"
          checked={aceitouTermos}
          onChange={(e) => setAceitouTermos(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
        <label htmlFor="aceitou_termos_checkbox" className="text-[11px] text-slate-600 leading-relaxed cursor-pointer font-light">
          Declaro que li, compreendi e concordo integralmente com os{' '}
          <a 
            href="/politicas" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-semibold text-blue-600 hover:text-blue-500 underline"
            onClick={(e) => e.stopPropagation()}
          >
            Termos de Uso
          </a>{' '}
          e com a{' '}
          <a 
            href="/politicas" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-semibold text-blue-600 hover:text-blue-500 underline"
            onClick={(e) => e.stopPropagation()}
          >
            Política de Privacidade
          </a>{' '}
          do Elo 57.
        </label>
      </div>

     {/* Selo de Segurança Asaas */}
     <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200/50 p-3.5 rounded-xl text-[10px] text-slate-500 leading-normal text-left">
       <span className="font-extrabold text-blue-600 uppercase tracking-wider text-[8px] bg-blue-50 border border-blue-150 px-1.5 py-0.5 rounded shrink-0">Parceiro Asaas</span>
       <span>🔒 Transação protegida por SSL e processada diretamente pela <strong>Asaas IP S.A.</strong> (instituição autorizada pelo Banco Central do Brasil). Não armazenamos os dados do seu cartão.</span>
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

  {/* Controle do Wizard */}
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
  <div></div>
  )}

  {step < 6 ? (
  <button
  type="button"
  disabled={loadingOtp}
  onClick={nextStep}
  className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent hover:bg-blue-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
  {loadingOtp ? (
    <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Processando...</>
  ) : (
    <>Próximo <ChevronRight className="ml-2 h-4 w-4" /></>
  )}
  </button>
  ) : (
  <button
  type="button"
  onClick={handleSubmit}
  disabled={loading || !aceitouTermos}
  className="inline-flex justify-center items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent hover:bg-blue-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto font-semibold"
  title={!aceitouTermos ? "Você precisa aceitar os Termos de Uso e Política de Privacidade" : "Finalizar cadastro"}
  >
  {loading ? (
  <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Processando Checkout...</>
  ) : (
  <><CheckCircle2 className="mr-2 h-4 w-4" /> Concluir Assinatura Seguro</>
  )}
  </button>
  )}
  </div>

 </form>
 </div>
 </div>

 <p className="mt-8 text-center text-sm text-gray-500">
 Já tem uma conta no Elo 57?{' '}
 <a href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
 Fazer login
 </a>
 </p>

  {/* Botão Flutuante de Debug para Injetar Dados Fictícios (Somente Local) */}
  {process.env.NODE_ENV === 'development' && (
    <button
      type="button"
      onClick={() => {
        setFormData({
          cnpj: '48.152.345/0001-97',
          razao_social: 'Studio 57 Empreendimentos Ltda',
          nome_fantasia: 'Studio 57',
          cep: '35162-000',
          address_street: 'Avenida Brasil',
          address_number: '120',
          neighborhood: 'Centro',
          city: 'Ipatinga',
          state: 'MG',
          admin_nome: 'Ranniere Campos',
          admin_email: 'rannierecampos1@gmail.com',
          admin_telefone: '33991912291',
          admin_senha: 'SenhaDeTeste123@',
          admin_senha_confirmacao: 'SenhaDeTeste123@'
        });
        setTipoPessoa('PJ');
        setStep(1);
      }}
      className="fixed bottom-4 left-4 z-50 inline-flex items-center px-4 py-2 text-xs font-bold text-slate-800 bg-amber-400 hover:bg-amber-500 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300 animate-bounce"
    >
      ⚡ Injetar Dados de Teste
    </button>
  )}
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