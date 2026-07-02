// app/planejamento-cobranca/page.js

'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  Database, 
  ChevronRight, 
  Code, 
  Sparkles, 
  Plus, 
  Minus, 
  Calendar, 
  DollarSign, 
  Percent, 
  Settings, 
  Info, 
  Layers,
  RefreshCw
} from 'lucide-react';

export default function PlanejamentoCobrancaPage() {
  const [activeTab, setActiveTab] = useState('fluxo');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [seats, setSeats] = useState(5);
  const [billingCycle, setBillingCycle] = useState('MONTHLY'); // MONTHLY or YEARLY
  const [trialDays, setTrialDays] = useState(90); // default 90 days (3 months)
  const [promoCode, setPromoCode] = useState('MUITOLINDO');
  const [hasPromo, setHasPromo] = useState(true);

  // States for interactive flow
  const [flowStep, setFlowStep] = useState(1);

  // Preços
  const planDetails = {
    essencial: { nome: 'Elo Essencial', valor: 127, desc: 'Recursos básicos administrativos e financeiros.' },
    pro: { nome: 'Elo Pro', valor: 297, desc: 'Gestão completa, comercial, funil e BIM 3D.' },
    ultra: { nome: 'Elo Ultra', valor: 497, desc: 'Automação inteligente e IA especializada.' }
  };

  // Cálculo de Valores
  const basePricePerUser = planDetails[selectedPlan].valor;
  const isYearly = billingCycle === 'YEARLY';
  
  // Desconto anual (20%)
  const discountMultiplier = isYearly ? 0.8 : 1.0;
  // Desconto cupom (10% se ativado)
  const promoDiscountMultiplier = (hasPromo && promoCode === 'MUITOLINDO') ? 0.9 : 1.0;
  
  const unitPriceFinal = Math.round(basePricePerUser * discountMultiplier * promoDiscountMultiplier);
  const totalValue = unitPriceFinal * seats;

  // Calculo de datas fictícias baseado no trial selecionado
  const getTrialExpirationDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('pt-BR');
  };

  const getTrialExpirationISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Asaas Payload Generator
  const generatePayload = () => {
    return {
      customer: "cus_000001234567", // ID do cliente sincronizado
      billingType: "UNDEFINED", // Permite Cartão, Pix ou Boleto no Checkout do Asaas
      value: totalValue,
      nextDueDate: getTrialExpirationISO(trialDays),
      cycle: billingCycle,
      description: `Assinatura ${planDetails[selectedPlan].nome} - ${seats} Usuários (Contratado via Onboarding)`,
      externalReference: `ORG_ID_VINCULADA`,
      callback: {
        successUrl: "https://studio57.arq.br/configuracoes/assinatura?status=ativada",
        autoRedirect: true
      }
    };
  };

  const sqlSchemaPlanos = `CREATE TABLE public.planos (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL, -- 'essencial', 'pro', 'ultra'
  nome text NOT NULL,
  valor_mensal numeric(10,2) NOT NULL,
  valor_anual numeric(10,2) NOT NULL,
  modulos_inclusos text[], -- array de permissões / módulos
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);`;

  const sqlSchemaPromocoes = `CREATE TABLE public.promocoes (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL, -- ex: 'MUITOLINDO'
  desconto_percentual numeric(5,2) DEFAULT 0.00,
  trial_days integer DEFAULT 15,
  ativo boolean DEFAULT true,
  valido_ate timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);`;

  const sqlAlterOrganizacoes = `ALTER TABLE public.organizacoes 
ADD COLUMN plano_codigo text REFERENCES public.planos(codigo),
ADD COLUMN seats_contracted integer DEFAULT 1,
ADD COLUMN cupom_aplicado text REFERENCES public.promocoes(codigo);`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Header */}
      <div className="relative overflow-hidden bg-slate-900 border-b border-slate-800 py-12 px-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#f25a2f]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#f25a2f]/20 text-[#f25a2f] border border-[#f25a2f]/30 mb-3 animate-pulse">
              <Sparkles className="h-3 w-3" /> Devonildo Mentor IA
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              Painel de Planejamento de <span className="text-[#f25a2f]">Cobrança</span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm md:text-base font-light max-w-2xl">
              Seu lindo, criei este espaço exclusivo para desenharmos e validarmos juntos o fluxo de assinaturas, tabela de planos, cupons de trial e integração definitiva com o Asaas.
            </p>
          </div>
          <div className="flex gap-2">
            <a 
              href="/configuracoes/assinatura" 
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl transition-all border border-slate-700 active:scale-95"
            >
              Ver Tela Atual de Assinatura
            </a>
          </div>
        </div>
      </div>

      {/* Tabs Nav */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        <div className="flex border-b border-slate-800 bg-slate-900/60 p-1.5 rounded-xl gap-2">
          <button 
            onClick={() => setActiveTab('fluxo')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'fluxo' ? 'bg-[#f25a2f] text-white shadow-lg shadow-[#f25a2f]/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <RefreshCw className="h-4 w-4" /> Ciclo de Vida do Cliente
          </button>
          <button 
            onClick={() => setActiveTab('banco')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'banco' ? 'bg-[#f25a2f] text-white shadow-lg shadow-[#f25a2f]/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Database className="h-4 w-4" /> Modelagem de Dados (SQL)
          </button>
          <button 
            onClick={() => setActiveTab('calculadora')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'calculadora' ? 'bg-[#f25a2f] text-white shadow-lg shadow-[#f25a2f]/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Code className="h-4 w-4" /> Simulador de Checkout (API)
          </button>
          <button 
            onClick={() => setActiveTab('roadmap')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'roadmap' ? 'bg-[#f25a2f] text-white shadow-lg shadow-[#f25a2f]/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Settings className="h-4 w-4" /> Roadmap de Execução
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* TAB 1: CICLO DE VIDA DO FLUXO */}
        {activeTab === 'fluxo' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Navegação Lateral do Fluxo */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-4">Etapas do Funil de Assinatura</h3>
                  
                  <div className="space-y-3">
                    {[
                      { step: 1, title: '1. Seleção na Landing Page', desc: 'Usuário clica em começar em um plano.' },
                      { step: 2, title: '2. Cadastro e Onboarding', desc: 'Preenchimento de dados cadastrais da empresa.' },
                      { step: 3, title: '3. Ativação via Checkout Asaas', desc: 'Inserção do cartão (R$ 0,00 cobrado na hora).' },
                      { step: 4, title: '4. Webhook / Registro Ativo', desc: 'O Asaas confirma o cartão e libera a conta.' },
                      { step: 5, title: '5. Fim do Trial / Primeira Cobrança', desc: 'Débito automático no cartão após o trial.' }
                    ].map(s => (
                      <div 
                        key={s.step}
                        onClick={() => setFlowStep(s.step)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${flowStep === s.step ? 'bg-slate-800 border-[#f25a2f]' : 'bg-slate-950 hover:bg-slate-800/40 border-slate-800/80'}`}
                      >
                        <h4 className={`text-xs font-bold ${flowStep === s.step ? 'text-[#f25a2f]' : 'text-slate-200'}`}>{s.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1 font-light">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detalhe da Etapa Selecionada */}
              <div className="lg:col-span-2">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 h-full flex flex-col justify-between">
                  <div>
                    <span className="text-xs bg-[#f25a2f]/10 text-[#f25a2f] border border-[#f25a2f]/20 font-bold px-3 py-1 rounded-full">
                      Etapa Selecionada
                    </span>

                    {/* Detalhes Dinâmicos */}
                    {flowStep === 1 && (
                      <div className="mt-6 space-y-6">
                        <h2 className="text-2xl font-bold text-white">1. Seleção na Landing Page</h2>
                        <p className="text-sm text-slate-350 font-light leading-relaxed">
                          O potencial cliente acessa a Landing Page do Elo 57. Ele visualiza os preços dos planos baseados em assentos (usuários ativos). 
                          Ao escolher um plano (ex: **Elo Pro** por R$ 297/mês), ele é direcionado para a tela de cadastro carregando o plano e as condições de trial (ex: *3 meses grátis*) na URL.
                        </p>
                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                          <h4 className="text-xs font-bold text-[#f25a2f]">Exemplo de URL de Redirecionamento:</h4>
                          <code className="text-xs text-blue-400 block break-all bg-slate-900 p-2.5 rounded">
                            {"https://studio57.arq.br/cadastro?plan=pro&promo=MUITOLINDO"}
                          </code>
                        </div>
                      </div>
                    )}

                    {flowStep === 2 && (
                      <div className="mt-6 space-y-6">
                        <h2 className="text-2xl font-bold text-white">2. Cadastro e Onboarding</h2>
                        <p className="text-sm text-slate-350 font-light leading-relaxed">
                          O usuário completa as 3 etapas clássicas de cadastro que já criamos: define Natureza Jurídica (PF/PJ), preenche CNPJ/CPF e Endereço, e cria as credenciais administrativas da conta.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">O que ocorre no banco:</span>
                            <ul className="text-xs text-slate-300 space-y-1.5 mt-2">
                              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Criação da Organização (`status: 'trialing'`)</li>
                              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Criação do registro em `cadastro_empresa`</li>
                              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Criação do login na tabela `auth.users`</li>
                            </ul>
                          </div>
                          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Integração do Onboarding:</span>
                            <p className="text-xs text-slate-400 mt-2 font-light leading-relaxed">
                              Em vez de redirecionar para a tela final de login comum, mantemos o usuário no fluxo e acionamos a sincronização com o Asaas para obter a URL do gateway seguro.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {flowStep === 3 && (
                      <div className="mt-6 space-y-6">
                        <h2 className="text-2xl font-bold text-white">3. Ativação via Checkout Asaas (R$ 0,00 Cobrado na Hora)</h2>
                        <p className="text-sm text-slate-350 font-light leading-relaxed">
                          A API cria a assinatura no Asaas com a primeira cobrança agendada para 90 dias no futuro. O cliente é redirecionado para a página segura do Asaas para preencher os dados de faturamento e salvar o cartão de crédito.
                        </p>
                        <div className="p-4 bg-[#f25a2f]/10 border border-[#f25a2f]/20 rounded-xl flex gap-3">
                          <Info className="h-5 w-5 text-[#f25a2f] flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-slate-300 leading-relaxed">
                            <span className="font-bold text-white block">PCI Compliance & Segurança:</span>
                            Nenhum número de cartão passa ou fica guardado no nosso banco. Tudo é preenchido diretamente na URL criptografada do Asaas. O Asaas faz uma transação de teste de R$ 0,00 no cartão do cliente para validar a integridade da conta e salvar a recorrência.
                          </div>
                        </div>
                      </div>
                    )}

                    {flowStep === 4 && (
                      <div className="mt-6 space-y-6">
                        <h2 className="text-2xl font-bold text-white">4. Webhook / Registro Ativo</h2>
                        <p className="text-sm text-slate-350 font-light leading-relaxed">
                          Ao concluir a transação de verificação do cartão, o webhook do Asaas dispara uma notificação segura para o nosso endpoint `/api/webhooks/asaas`. O sistema prorroga os limites da conta no banco de dados e ativa o plano.
                        </p>
                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payload de Notificação Recebido:</span>
                          <pre className="text-[10px] text-green-400 bg-slate-900 p-3 rounded overflow-x-auto max-h-40 font-mono">
{`{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_982138237912",
    "subscription": "sub_jitkldn06mp8405q",
    "value": 0.00,
    "status": "RECEIVED"
  }
}`}
                          </pre>
                        </div>
                      </div>
                    )}

                    {flowStep === 5 && (
                      <div className="mt-6 space-y-6">
                        <h2 className="text-2xl font-bold text-white">5. Fim do Trial / Primeira Cobrança</h2>
                        <p className="text-sm text-slate-350 font-light leading-relaxed">
                          Decorridos os 90 dias do período promocional grátis, o sistema de recorrência do Asaas executa de forma automática o débito do valor contratado (ex: R$ 1.485,00 para 5 assentos no plano Elo Pro) no cartão cadastrado.
                        </p>
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3">
                          <Sparkles className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-slate-300 leading-relaxed">
                            <span className="font-bold text-white block">Automação Silenciosa:</span>
                            Caso o cartão do cliente seja recusado por falta de limite ou expiração, o Asaas nos notifica via webhook com `PAYMENT_OVERDUE`. Nosso middleware suspende a conta localmente até que um novo cartão seja preenchido nas Configurações.
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Fluxograma Horizontal de Status */}
                  <div className="mt-8 border-t border-slate-800 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl">
                      <div className="text-center">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Landing Page</span>
                        <span className="text-xs font-semibold text-slate-300">Escolha do Plano</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-700 hidden sm:block" />
                      <div className="text-center">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Banco de Dados</span>
                        <span className="text-xs font-semibold text-slate-300">Criar Org (Trialing)</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-700 hidden sm:block" />
                      <div className="text-center">
                        <span className="text-[9px] font-bold text-[#f25a2f] uppercase block">Asaas API</span>
                        <span className="text-xs font-semibold text-slate-300">Checkout Gerado</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-700 hidden sm:block" />
                      <div className="text-center">
                        <span className="text-[9px] font-bold text-green-500 uppercase block">Webhook</span>
                        <span className="text-xs font-semibold text-slate-300">Ativação da Conta</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: MODELAGEM DE BANCO (SQL) */}
        {activeTab === 'banco' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Database className="h-6 w-6 text-[#f25a2f]" />
                <div>
                  <h3 className="text-lg font-bold text-white">Modelagem do Banco de Dados</h3>
                  <p className="text-xs text-slate-400 font-light">Estruturas necessárias no Supabase para controlar planos, preços e promoções.</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Tabela de Planos */}
                <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[#f25a2f] uppercase">Tabela 1: planos</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono">public.planos</span>
                    </div>
                    <p className="text-xs text-slate-400 font-light mb-4">
                      Tabela estática para guardar os planos cadastrados na plataforma e seus respectivos valores.
                    </p>
                    <pre className="text-[10px] text-slate-300 bg-slate-900 p-3 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                      {sqlSchemaPlanos}
                    </pre>
                  </div>
                </div>

                {/* Tabela de Promoções / Cupons */}
                <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[#f25a2f] uppercase">Tabela 2: promocoes</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono">public.promocoes</span>
                    </div>
                    <p className="text-xs text-slate-400 font-light mb-4">
                      Tabela para cupons e promoções com dias de trial estendidos (ex: 90 dias) e descontos no plano.
                    </p>
                    <pre className="text-[10px] text-slate-300 bg-slate-900 p-3 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                      {sqlSchemaPromocoes}
                    </pre>
                  </div>
                </div>

                {/* Alterações em Organizações */}
                <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[#f25a2f] uppercase">Alter: organizacoes</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono">public.organizacoes</span>
                    </div>
                    <p className="text-xs text-slate-400 font-light mb-4">
                      Modificações na tabela de organizações para referenciar qual plano ela assinou, usuários contratados e cupom aplicado.
                    </p>
                    <pre className="text-[10px] text-slate-300 bg-slate-900 p-3 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                      {sqlAlterOrganizacoes}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Relação Relacional */}
              <div className="mt-8 p-6 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="text-sm font-bold text-white mb-4">Mapeamento de Multitenancy Relacional</h4>
                <div className="grid md:grid-cols-3 gap-6 text-xs font-light text-slate-300">
                  <div className="space-y-2">
                    <span className="font-bold text-white block">1. Usuários por Assento (Seats)</span>
                    <p>
                      Em vez de plano de valor fixo, o sistema computa o limite de usuários ativos cadastrados no time baseando-se no campo `seats_contracted`. O middleware bloqueia a criação de novos usuários se ultrapassar esse número.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="font-bold text-white block">2. Cupom Fiel à Origem</span>
                    <p>
                      O cupom usado no checkout da LP é salvo diretamente na Organização. Isso garante rastreabilidade e impede fraudes na data de vencimento da mensalidade gerada.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="font-bold text-white block">3. Tolerância Automática (Grace Period)</span>
                    <p>
                      As faturas vencidas no Asaas mudam o `subscription_status` local para `'overdue'`. O middleware garante uma tolerância padrão (Grace Period) de 3 dias de atraso antes de bloquear totalmente o login ou operações do cliente.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: CALCULADORA DE CHECKOUT */}
        {activeTab === 'calculadora' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid lg:grid-cols-12 gap-8">
              
              {/* Controles do Simulador */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  
                  <div>
                    <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-2">Simulador de Assinatura</h3>
                    <p className="text-xs text-slate-500">Configure as condições para simular o payload de envio para o Asaas.</p>
                  </div>

                  {/* Seleção do Plano */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">1. Selecione o Plano</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.keys(planDetails).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedPlan(p)}
                          className={`p-3 rounded-lg border text-xs font-bold transition-all ${selectedPlan === p ? 'bg-[#f25a2f] border-[#f25a2f] text-white shadow-lg' : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'}`}
                        >
                          {planDetails[p].nome}
                          <span className="block text-[9px] font-normal mt-1">R$ {planDetails[p].valor}/mês</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Número de Assentos (Seats) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-300">2. Número de Assentos (Usuários)</label>
                      <span className="text-xs font-bold text-[#f25a2f] bg-[#f25a2f]/10 px-2.5 py-0.5 rounded-full">{seats} usuários</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSeats(prev => Math.max(1, prev - 1))}
                        className="w-10 h-10 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-lg flex items-center justify-center font-bold text-lg"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        value={seats}
                        onChange={(e) => setSeats(parseInt(e.target.value))}
                        className="flex-1 accent-[#f25a2f]"
                      />
                      <button 
                        onClick={() => setSeats(prev => Math.min(100, prev + 1))}
                        className="w-10 h-10 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-lg flex items-center justify-center font-bold text-lg"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Frequência de Faturamento */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">3. Ciclo de Cobrança</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-850">
                      <button
                        type="button"
                        onClick={() => setBillingCycle('MONTHLY')}
                        className={`py-2 rounded-md text-xs font-bold transition-all ${billingCycle === 'MONTHLY' ? 'bg-slate-850 text-white shadow' : 'text-slate-500'}`}
                      >
                        Mensal
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle('YEARLY')}
                        className={`py-2 rounded-md text-xs font-bold transition-all ${billingCycle === 'YEARLY' ? 'bg-slate-850 text-white shadow' : 'text-slate-500'}`}
                      >
                        Anual (-20%)
                      </button>
                    </div>
                  </div>

                  {/* Período de Testes (Trial) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-300">4. Período de Testes Grátis (Trial)</label>
                      <span className="text-xs font-bold text-slate-400">{trialDays} dias</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 15, 30, 90].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setTrialDays(d)}
                          className={`py-2 rounded-lg border text-xs font-bold transition-all ${trialDays === d ? 'bg-[#f25a2f]/20 border-[#f25a2f] text-[#f25a2f]' : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-400'}`}
                        >
                          {d === 0 ? 'Sem Trial' : `${d} dias`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cupom Promocional */}
                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-300">Cupom de Desconto</label>
                      <button 
                        onClick={() => setHasPromo(!hasPromo)}
                        className={`text-[10px] uppercase tracking-wider font-extrabold ${hasPromo ? 'text-green-500' : 'text-slate-500'}`}
                      >
                        {hasPromo ? 'Ativado (-10%)' : 'Desativar'}
                      </button>
                    </div>
                    {hasPromo && (
                      <div className="relative">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-green-400 font-bold focus:ring-1 focus:ring-green-500 outline-none uppercase"
                          placeholder="Digite o cupom"
                        />
                        <Percent className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Visualização de Resumos & Payload do Asaas */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Resumo Gerencial de Valores */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 grid sm:grid-cols-3 gap-6">
                  <div className="sm:col-span-1 border-r border-slate-800/80 pr-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Preço Unitário / Usuário</span>
                    <div className="mt-1 flex items-baseline text-white">
                      <span className="text-2xl font-black">R$ {unitPriceFinal}</span>
                      <span className="text-[10px] text-slate-500 ml-1">/mês</span>
                    </div>
                    {isYearly && <span className="text-[9px] text-green-400 font-bold">-20% desconto anual</span>}
                  </div>
                  
                  <div className="sm:col-span-1 border-r border-slate-800/80 pr-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Primeiro Pagamento</span>
                    <div className="mt-1 flex items-center text-white">
                      <Calendar className="h-4 w-4 text-slate-500 mr-1.5" />
                      <span className="text-sm font-bold">{getTrialExpirationDate(trialDays)}</span>
                    </div>
                    {trialDays > 0 ? (
                      <span className="text-[9px] text-[#f25a2f] font-semibold">{trialDays} dias de trial grátis</span>
                    ) : (
                      <span className="text-[9px] text-slate-500">Cobrança gerada hoje</span>
                    )}
                  </div>

                  <div className="sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Valor total recorrente</span>
                    <div className="mt-1 flex items-baseline text-white">
                      <span className="text-2xl font-black text-[#f25a2f]">R$ {totalValue}</span>
                      <span className="text-[10px] text-slate-500 ml-1">/ciclo</span>
                    </div>
                    <span className="text-[9px] text-slate-500">Recorrência no ciclo {billingCycle === 'MONTHLY' ? 'Mensal' : 'Anual'}</span>
                  </div>
                </div>

                {/* Exibição do Payload do Asaas */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payload Gerado para a API do Asaas</span>
                    <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-blue-400 font-mono">POST /v3/subscriptions</span>
                  </div>
                  <pre className="text-xs text-green-400 bg-slate-950 p-4 rounded-xl border border-slate-850 font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(generatePayload(), null, 2)}
                  </pre>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 4: ROADMAP DE EXECUÇÃO */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6 animate-in fade-in duration-350">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              
              <div className="flex items-center gap-3 mb-6">
                <Layers className="h-6 w-6 text-[#f25a2f]" />
                <div>
                  <h3 className="text-lg font-bold text-white">Roadmap e Checklist de Implementação</h3>
                  <p className="text-xs text-slate-400 font-light">A ordem de trabalho recomendada para implantarmos as modificações sem quebrar o sistema atual.</p>
                </div>
              </div>

              <div className="space-y-6 mt-8">
                
                {/* Fase 1 */}
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-850">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                    <h4 className="text-sm font-bold text-[#f25a2f] flex items-center gap-2">
                      Fase 1: Execução das Migrações e Atualização do Schema
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 bg-slate-800 rounded-full font-bold text-slate-300">Fácil</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light mb-4">
                    Precisamos rodar no Supabase o script DDL que cria a tabela `planos` (com os registros de base de R$ 127, R$ 297 e R$ 497), a tabela de `promocoes`, e atualiza a tabela de `organizacoes` para permitir guardar o plano selecionado.
                  </p>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Ação do DevOps:</span>
                    <span className="text-xs font-mono text-slate-300 block mt-1">Executar as queries criadas no Tab 2 pelo console do Supabase.</span>
                  </div>
                </div>

                {/* Fase 2 */}
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-850">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Fase 2: Expansão da API de Registro (`app/cadastro/actions.js`)
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 bg-blue-500/20 rounded-full font-bold text-blue-400">Médio</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light mb-4">
                    Modificar a ação executada em "Criar a minha conta". Em vez de apenas salvar no banco, ela vai:
                    1. Computar a promoção na tabela `promocoes` (para ver o tempo de trial e cupom).
                    2. Chamar o Asaas para registrar o cliente (`obterOuCriarCliente`).
                    3. Gerar a assinatura de ciclo do plano, calculando a data de vencimento da primeira parcela (`nextDueDate`) com o trial correspondente.
                    4. Salvar o `asaas_subscription_id` e a URL de checkout no retorno.
                  </p>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Arquivo a ser editado:</span>
                    <span className="text-xs font-mono text-[#f25a2f] block mt-1">app/cadastro/actions.js</span>
                  </div>
                </div>

                {/* Fase 3 */}
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-850">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Fase 3: Fluxo de Redirecionamento da LP e Onboarding
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 bg-blue-500/20 rounded-full font-bold text-blue-400">Médio</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light mb-4">
                    Adicionar na Landing Page o redirecionamento com parâmetros do plano escolhido (`/cadastro?plan=pro`). No frontend de cadastro, o wizard captura isso e insere no payload de submissão do formulário. Assim que a conta é criada, redirecionamos o usuário automaticamente para a URL de pagamento seguro do Asaas.
                  </p>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Arquivos a serem editados:</span>
                    <span className="text-xs font-mono text-[#f25a2f] block mt-1">app/(landingpages)/elo57/components/PricingSection.js e app/cadastro/page.js</span>
                  </div>
                </div>

                {/* Fase 4 */}
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-850">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Fase 4: Expansão do Middleware de Acesso & Roteamento
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 bg-[#f25a2f]/20 rounded-full font-bold text-[#f25a2f]">Complexo</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-light mb-4">
                    Caso a organização assine mas abandone o checkout do Asaas antes de preencher o cartão, ela não terá um cartão tokenizado cadastrado e a assinatura constará como inadimplente. O middleware de rotas (`middleware.js`) deve interceptar usuários com `subscription_status = 'pending_payment'` ou `'overdue'` e redirecioná-los forçadamente para a página de faturamento para regularizarem o cartão de crédito, impedindo que acessem o ERP.
                  </p>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Arquivos a serem editados:</span>
                    <span className="text-xs font-mono text-[#f25a2f] block mt-1">middleware.js</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
