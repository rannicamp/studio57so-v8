// app/planejamento-cobranca/page.js

'use client';

import { useState } from 'react';
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
  Settings, 
  Info, 
  Layers,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  Play
} from 'lucide-react';

export default function PlanejamentoCobrancaPage() {
  const [selectedNode, setSelectedNode] = useState('cadastro');
  
  // States for Simulator
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [seats, setSeats] = useState(5);
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [trialDays, setTrialDays] = useState(90);
  const [promoCode, setPromoCode] = useState('MUITOLINDO');
  const [hasPromo, setHasPromo] = useState(true);

  const planDetails = {
    essencial: { nome: 'Elo Essencial', valor: 127, desc: 'Recursos essenciais administrativos e financeiros.' },
    pro: { nome: 'Elo Pro', valor: 297, desc: 'Gestão completa, comercial, funil e BIM 3D.' },
    ultra: { nome: 'Elo Ultra', valor: 497, desc: 'Automação inteligente e IA especializada.' }
  };

  const basePricePerUser = planDetails[selectedPlan].valor;
  const isYearly = billingCycle === 'YEARLY';
  const discountMultiplier = isYearly ? 0.8 : 1.0;
  const promoDiscountMultiplier = (hasPromo && promoCode === 'MUITOLINDO') ? 0.9 : 1.0;
  const unitPriceFinal = Math.round(basePricePerUser * discountMultiplier * promoDiscountMultiplier);
  const totalValue = unitPriceFinal * seats;

  const getTrialExpirationISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const generateAsaasPayload = () => {
    return {
      customer: "cus_000001234567",
      billingType: "UNDEFINED", // Habilita todos os métodos no checkout do Asaas
      value: totalValue,
      nextDueDate: getTrialExpirationISO(trialDays),
      cycle: billingCycle,
      description: `Assinatura ${planDetails[selectedPlan].nome} - ${seats} Usuários (Período de Testes de ${trialDays} dias)`,
      externalReference: "ID_DA_ORGANIZACAO_LOCAL",
      callback: {
        successUrl: "https://studio57.arq.br/configuracoes/assinatura?status=ativada",
        autoRedirect: true
      }
    };
  };

  // Definição dos nós do Mapa Mental
  const nodes = {
    landing: {
      id: 'landing',
      phase: 'Fase 1: Entrada',
      title: 'Landing Page (LP)',
      icon: Sparkles,
      color: 'border-amber-400 bg-amber-50 text-amber-700',
      badge: 'Ponto de Partida',
      summary: 'Captura o plano e o cupom de trial escolhidos pelo usuário.',
      details: {
        description: 'O fluxo se inicia quando o cliente navega pela LP do Elo 57 e clica em assinar um plano. A LP envia os parâmetros para a rota de cadastro via URL.',
        technical: 'Configurar os botões de ação dos planos na Landing Page para redirecionar para:',
        code: '/cadastro?plan=pro&promo=MUITOLINDO',
        files: ['app/(landingpages)/elo57/components/PricingSection.js'],
        checklist: [
          'Adicionar query params nos links de "Começar Agora" da LP.',
          'Mapear os códigos dos planos (essencial, pro, ultra) nos links.'
        ]
      }
    },
    cadastro: {
      id: 'cadastro',
      phase: 'Fase 1: Entrada',
      title: 'Cadastro do Workspace',
      icon: Building2,
      color: 'border-blue-500 bg-blue-50 text-blue-700',
      badge: 'Supabase DB',
      summary: 'Criação do usuário, organização e empresa local no banco.',
      details: {
        description: 'O usuário realiza o cadastro de sua conta administradora e de sua empresa. O sistema cria as tabelas locais no Supabase.',
        technical: 'Ao criar a Organização no Supabase, ela é criada com o status inicial de "trialing".',
        code: `// Estrutura criada no Supabase:\npublic.organizacoes (status: 'trialing')\npublic.cadastro_empresa (CNPJ, Razão Social, CEP, etc.)\nauth.users (admin_email, admin_senha)`,
        files: ['app/cadastro/actions.js', 'app/cadastro/page.js'],
        checklist: [
          'Ajustar o wizard de cadastro para receber e persistir os parâmetros da URL.',
          'Reter os dados fiscais coletados para o próximo nó (Asaas).'
        ]
      }
    },
    sync_asaas: {
      id: 'sync_asaas',
      phase: 'Fase 2: Integração',
      title: 'Sincronizar Asaas',
      icon: Database,
      color: 'border-indigo-500 bg-indigo-50 text-indigo-700',
      badge: 'Asaas API',
      summary: 'Cria ou atualiza o cliente no Asaas com dados fiscais locais.',
      details: {
        description: 'Para gerar faturas e cartões, o Asaas exige o CPF/CNPJ e dados de endereço completos. Sincronizamos a empresa local com o Asaas.',
        technical: 'Chamar obterOuCriarCliente passando Razão Social, CNPJ, Telefone e CEP. Se o cliente já existir, atualiza com PUT para garantir o preenchimento de dados.',
        code: `const customer = await obterOuCriarCliente({\n  nome: empresa.razao_social,\n  cpfCnpj: empresa.cnpj,\n  postalCode: empresa.cep,\n  email: user.email\n});`,
        files: ['lib/asaas.js', 'app/cadastro/actions.js'],
        checklist: [
          'Garantir higienização de strings (remover pontuações de CNPJ e CEP).',
          'Gravar o asaas_customer_id gerado na tabela public.organizacoes.'
        ]
      }
    },
    criar_assinatura: {
      id: 'criar_assinatura',
      phase: 'Fase 3: Recorrência',
      title: 'Criar Assinatura (Trial)',
      icon: Calendar,
      color: 'border-purple-500 bg-purple-50 text-purple-700',
      badge: 'Faturamento',
      summary: 'Configuração do plano e agendamento da primeira cobrança pós-trial.',
      details: {
        description: 'Criação do plano de recorrência no Asaas com a primeira cobrança agendada para 90 dias (trial) no futuro.',
        technical: 'Utilizar cycle como MONTHLY ou YEARLY, billingType como UNDEFINED e nextDueDate como a data de expiração do trial.',
        code: `const assinatura = await criarAssinatura({\n  clienteId: customer.id,\n  valor: totalCalculado,\n  ciclo: 'YEARLY',\n  dataVencimento: '2026-10-02' // Hoje + 90 dias\n});`,
        files: ['lib/asaas.js', 'app/api/subscriptions/checkout/route.js'],
        checklist: [
          'Mapear a data do trial baseando-se no cupom da promoção.',
          'Salvar o asaas_subscription_id gerado na tabela public.organizacoes.'
        ]
      }
    },
    checkout_cartao: {
      id: 'checkout_cartao',
      phase: 'Fase 3: Recorrência',
      title: 'Checkout & Cartão',
      icon: CreditCard,
      color: 'border-[#f25a2f] bg-orange-50 text-[#f25a2f]',
      badge: 'Segurança',
      summary: 'Redirecionamento ao checkout seguro para inserir o cartão.',
      details: {
        description: 'O cliente insere seu cartão no checkout seguro do Asaas. O Asaas valida o cartão e o vincula à assinatura recorrente futura.',
        technical: 'Redirecionar o usuário para a URL invoiceUrl da primeira cobrança. Ao salvar o cartão, a assinatura se auto-atualiza.',
        code: `// Redirecionamento no frontend:\nwindow.location.href = checkoutUrl;`,
        files: ['app/cadastro/page.js', 'app/api/subscriptions/checkout/route.js'],
        checklist: [
          'Capturar a URL de checkout retornada na criação da assinatura.',
          'Redirecionar o usuário para o Asaas após a etapa final do cadastro.'
        ]
      }
    },
    webhook_ativacao: {
      id: 'webhook_ativacao',
      phase: 'Fase 4: Confirmação',
      title: 'Webhook Ativação',
      icon: CheckCircle2,
      color: 'border-emerald-500 bg-emerald-50 text-emerald-700',
      badge: 'Ativação',
      summary: 'Notificação do Asaas ativando o plano localmente.',
      details: {
        description: 'O webhook processa a resposta do Asaas confirmando que o cartão do cliente foi salvo e validado com sucesso.',
        technical: 'Escutar eventos PAYMENT_RECEIVED ou PAYMENT_CONFIRMED, buscar a assinatura correspondente e mudar o status para active.',
        code: `// No webhook:\nawait supabaseAdmin\n  .from('organizacoes')\n  .update({ subscription_status: 'active' })\n  .eq('asaas_subscription_id', subscriptionId);`,
        files: ['app/api/webhooks/asaas/route.js'],
        checklist: [
          'Validar a assinatura do Webhook Token do Asaas por segurança.',
          'Sincronizar a data final de validade da assinatura no banco.'
        ]
      }
    },
    middleware_bloqueio: {
      id: 'middleware_bloqueio',
      phase: 'Fase 4: Confirmação',
      title: 'Middleware de Acesso',
      icon: Settings,
      color: 'border-rose-500 bg-rose-50 text-rose-700',
      badge: 'Segurança',
      summary: 'Redireciona inadimplentes ou trials expirados para a tela de faturamento.',
      details: {
        description: 'Middleware que intercepta rotas do ERP e obriga o usuário a regularizar o pagamento caso o trial expire ou ocorra atraso.',
        technical: 'Se subscription_status for overdue ou pending_payment, redireciona o usuário para /configuracoes/assinatura e bloqueia o restante.',
        code: `if (org.subscription_status === 'overdue' && path !== '/configuracoes/assinatura') {\n  return NextResponse.redirect('/configuracoes/assinatura');\n}`,
        files: ['middleware.js'],
        checklist: [
          'Ignorar as rotas públicas e estáticas na checagem de assinatura.',
          'Garantir uma tolerância de 3 dias (Grace Period) antes de bloquear o usuário.'
        ]
      }
    }
  };

  const selectedData = nodes[selectedNode];

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans pb-16 relative">
      {/* Background Grid Pattern (Blank Canvas / Mental Map feel) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 pointer-events-none"></div>

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 py-6 px-8 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm font-bold text-lg">
              E
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Mapa Mental de Implantação <span className="text-xs bg-[#f25a2f]/10 text-[#f25a2f] border border-[#f25a2f]/20 px-2 py-0.5 rounded-full font-bold">Cobrança Asaas</span>
              </h1>
              <p className="text-xs text-slate-500 font-light">Seu lindo, clique nos nós do mapa para visualizar os requisitos, SQLs e arquivos de cada fase.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-light mr-2">Servidor local rodando</span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-8 mt-12 grid lg:grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COLUMN: MIND MAP CANVAS */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Canvas Section */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm relative overflow-hidden">
            
            <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Fluxo Cronológico de Ativação</h3>
              <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-semibold">Clique para selecionar</span>
            </div>

            {/* Mind Map Tree Nodes */}
            <div className="space-y-12 relative">
              
              {/* Vertical Connector Line (CSS) */}
              <div className="absolute left-[31px] top-6 bottom-6 w-0.5 bg-slate-200 -z-10"></div>

              {/* FASE 1 */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-[46px]">Fase 1: Entrada de Usuários</span>
                
                {/* Node: Landing Page */}
                <div 
                  onClick={() => setSelectedNode('landing')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedNode === 'landing' ? 'border-amber-400 bg-amber-50/50 shadow-md translate-x-2' : 'border-slate-200 bg-white hover:border-slate-350'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Selecione o Plano na LP</h4>
                    <p className="text-xs text-slate-500 mt-1 font-light">Envio de plano e cupom via URL para a tela de registro.</p>
                  </div>
                </div>

                {/* Node: Cadastro */}
                <div 
                  onClick={() => setSelectedNode('cadastro')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedNode === 'cadastro' ? 'border-blue-500 bg-blue-50/50 shadow-md translate-x-2' : 'border-slate-200 bg-white hover:border-slate-350'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Criar Workspace no Supabase</h4>
                    <p className="text-xs text-slate-500 mt-1 font-light">Cadastro do administrador, empresa e organização local.</p>
                  </div>
                </div>
              </div>

              {/* FASE 2 */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-[46px]">Fase 2: Conexão Asaas</span>
                
                {/* Node: Sync Asaas */}
                <div 
                  onClick={() => setSelectedNode('sync_asaas')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedNode === 'sync_asaas' ? 'border-indigo-500 bg-indigo-50/50 shadow-md translate-x-2' : 'border-slate-200 bg-white hover:border-slate-350'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Sincronizar Cliente no Asaas</h4>
                    <p className="text-xs text-slate-500 mt-1 font-light">Puxa dados locais da empresa para criar/atualizar cliente no Asaas.</p>
                  </div>
                </div>
              </div>

              {/* FASE 3 */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-[46px]">Fase 3: Recorrência & Faturamento</span>
                
                {/* Node: Criar Assinatura */}
                <div 
                  onClick={() => setSelectedNode('criar_assinatura')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedNode === 'criar_assinatura' ? 'border-purple-500 bg-purple-50/50 shadow-md translate-x-2' : 'border-slate-200 bg-white hover:border-slate-350'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Gerar Assinatura com Trial</h4>
                    <p className="text-xs text-slate-500 mt-1 font-light">Cria a assinatura no Asaas e agenda o vencimento da cobrança para 90 dias.</p>
                  </div>
                </div>

                {/* Node: Checkout Cartão */}
                <div 
                  onClick={() => setSelectedNode('checkout_cartao')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedNode === 'checkout_cartao' ? 'border-[#f25a2f] bg-orange-50/50 shadow-md translate-x-2' : 'border-slate-200 bg-white hover:border-slate-350'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#f25a2f] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Checkout e Tokenização do Cartão</h4>
                    <p className="text-xs text-slate-500 mt-1 font-light">Usuário acessa o Asaas, preenche o cartão e valida os dados.</p>
                  </div>
                </div>
              </div>

              {/* FASE 4 */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-[46px]">Fase 4: Liberação de Acesso</span>
                
                {/* Node: Webhook Ativação */}
                <div 
                  onClick={() => setSelectedNode('webhook_ativacao')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedNode === 'webhook_ativacao' ? 'border-emerald-500 bg-emerald-50/50 shadow-md translate-x-2' : 'border-slate-200 bg-white hover:border-slate-350'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Webhook de Ativação do Plano</h4>
                    <p className="text-xs text-slate-500 mt-1 font-light">Asaas avisa que o cartão é válido e o sistema ativa a Org no banco.</p>
                  </div>
                </div>

                {/* Node: Middleware Bloqueio */}
                <div 
                  onClick={() => setSelectedNode('middleware_bloqueio')}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedNode === 'middleware_bloqueio' ? 'border-rose-500 bg-rose-50/50 shadow-md translate-x-2' : 'border-slate-200 bg-white hover:border-slate-350'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Middleware de Acesso & Bloqueio</h4>
                    <p className="text-xs text-slate-500 mt-1 font-light">Intercepta rotas do ERP se a assinatura expirar ou atrasar.</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: TECHNICAL PANEL (DETALHES DO NÓ SELECIONADO) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card Detalhado do Nó */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedData.phase}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${selectedData.color}`}>
                {selectedData.badge}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <selectedData.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{selectedData.title}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-light">
              {selectedData.details.description}
            </p>

            {/* Checklist */}
            <div className="space-y-2 pt-4 border-t border-slate-150">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">O que precisa ser feito:</span>
              <ul className="text-xs text-slate-600 space-y-2">
                {selectedData.details.checklist.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 font-light">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f25a2f] mt-1.5 flex-shrink-0"></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Código ou Requisito Técnico */}
            <div className="space-y-2 pt-4 border-t border-slate-150">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Comportamento/Script Técnico:</span>
              <p className="text-[11px] text-slate-500 font-light italic mb-1">{selectedData.details.technical}</p>
              <pre className="text-[10px] text-green-700 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono overflow-x-auto whitespace-pre-wrap">
                {selectedData.details.code}
              </pre>
            </div>

            {/* Arquivos Afetados */}
            <div className="space-y-2 pt-4 border-t border-slate-150">
              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Arquivos do Projeto Afetados:</span>
              <div className="flex flex-wrap gap-1">
                {selectedData.details.files.map((file, index) => (
                  <span key={index} className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {file}
                  </span>
                ))}
              </div>
            </div>

          </div>

          {/* Simulador Dinâmico Acoplado (Para ver os payloads reais) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calculadora de Assinaturas</h3>
            <p className="text-xs text-slate-500 font-light">Simule o payload final que será gerado nos endpoints com base nas escolhas:</p>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Plano</span>
                  <select 
                    value={selectedPlan} 
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 mt-1 font-bold text-slate-700"
                  >
                    <option value="essencial">Elo Essencial (R$ 127)</option>
                    <option value="pro">Elo Pro (R$ 297)</option>
                    <option value="ultra">Elo Ultra (R$ 497)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Ciclo</span>
                  <select 
                    value={billingCycle} 
                    onChange={(e) => setBillingCycle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 mt-1 font-bold text-slate-700"
                  >
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual (-20%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Usuários (Assentos)</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={seats} 
                    onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 mt-1 font-bold text-slate-700"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Trial (Dias)</span>
                  <input 
                    type="number" 
                    min="0" 
                    max="180" 
                    value={trialDays} 
                    onChange={(e) => setTrialDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 mt-1 font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Cupom */}
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Cupom</span>
                <input 
                  type="text" 
                  value={promoCode} 
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 mt-1 font-bold text-slate-700 uppercase"
                  placeholder="EX: MUITOLINDO"
                />
              </div>

              {/* Resultado e Payload em JSON */}
              <div className="pt-4 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-500">Valor Recorrente:</span>
                <span className="text-lg font-black text-[#f25a2f]">R$ {totalValue} <span className="text-xs font-normal text-slate-450">/ ciclo</span></span>
              </div>

              <div className="pt-2">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-1">Payload JSON gerado para Asaas:</span>
                <pre className="text-[9px] font-mono text-green-700 bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto max-h-40">
                  {JSON.stringify(generateAsaasPayload(), null, 2)}
                </pre>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
