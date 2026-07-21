"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRobot,
  faCubes,
  faCode,
  faLayerGroup,
  faVideo,
  faCloudUploadAlt,
  faDatabase,
  faCheckCircle,
  faLaptopCode,
  faTerminal,
  faPlug,
  faBullhorn,
  faChartLine,
  faMagic,
  faLightbulb,
  faProjectDiagram,
  faBoxes,
  faArrowRight,
  faServer,
  faMicrochip,
  faBolt,
  faWrench,
  faBuilding,
  faChevronDown,
  faCheckDouble,
  faPlay,
  faCheck,
  faGraduationCap,
  faBookOpen,
  faRoute,
  faBrain,
  faBalanceScale,
  faListCheck,
  faSliders,
  faNetworkWired,
  faExchangeAlt,
  faShieldAlt,
  faMobileAlt,
  faCalculator,
  faReceipt,
  faFileInvoiceDollar,
  faUserCheck,
  faSearchDollar,
  faPiggyBank,
  faRulerCombined,
  faCalendarAlt,
  faCoins,
  faObjectGroup,
  faFilePdf,
  faVrCardboard,
  faCompass,
  faGlobe,
  faFileImage
} from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';

const SECTIONS = [
  { id: 'hero', label: '1. Capa' },
  { id: 'overview', label: '2. Antigravity IA' },
  { id: 'customizations', label: '3. Regras, Workflows & Skills' },
  { id: 'mcp-explain', label: '4. O que é o MCP?' },
  { id: 'mcp-servers', label: '5. Nossos 6 Servidores MCP' },
  { id: 'amanda-finance', label: '6. Caso 1: Amanda no Financeiro' },
  { id: 'bim-engineering', label: '7. Caso 2: BIM, Quantitativos & Orçamento' },
  { id: 'architecture', label: '8. Arquitetura Elo 57' },
  { id: 'tools-libraries', label: '9. Bibliotecas & Mídia Instaladas' },
  { id: 'cases', label: '10. Mais Casos Práticos' },
  { id: 'cta', label: '11. Conclusão' }
];

export default function WorkshopAntigravityLandingPage() {
  const [activeSection, setActiveSection] = useState('hero');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isTypingLog, setIsTypingLog] = useState(false);
  const [remotionFrame, setRemotionFrame] = useState(0);

  // IntersectionObserver para os Dots Flutuantes
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.25
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => {
      SECTIONS.forEach((section) => {
        const el = document.getElementById(section.id);
        if (el) observer.unobserve(el);
      });
    };
  }, []);

  // Animação do Terminal do Devonildo
  useEffect(() => {
    const logsSequence = [
      { text: '> Antigravity Agent inicializado. Persona: Devonildo (Mentor Técnico).', type: 'info' },
      { text: '> Lendo diretrizes de design em .agents/rules/DESIGN_SYSTEM.md...', type: 'success' },
      { text: '> Verificando regras de RLS Multi-Tenant (organizacao_id = 1 ou get_auth_user_org())...', type: 'success' },
      { text: '> Consultando RPCs disponíveis no banco do Elo 57...', type: 'info' },
      { text: '> Chamando ferramenta MCP elo57/mover_lead_funil (Lead ID #4092 -> Fase Qualificados)...', type: 'warning' },
      { text: '> Servidor local compilado com sucesso em 420ms (0 erros).', type: 'success' },
      { text: '> Devonildo: "Prontinho, seu lindo! Apresentação pronta!"', type: 'highlight' }
    ];

    let currentIndex = 0;
    setTerminalLogs([logsSequence[0]]);

    const interval = setInterval(() => {
      if (currentIndex < logsSequence.length - 1) {
        currentIndex++;
        setIsTypingLog(true);
        setTimeout(() => {
          setIsTypingLog(false);
          setTerminalLogs(prev => [...prev, logsSequence[currentIndex]]);
        }, 1200);
      } else {
        setTimeout(() => {
          setTerminalLogs([logsSequence[0]]);
          currentIndex = 0;
        }, 6000);
      }
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  // Animação do Player Remotion
  useEffect(() => {
    const frameInterval = setInterval(() => {
      setRemotionFrame(prev => (prev + 1) % 60);
    }, 50);
    return () => clearInterval(frameInterval);
  }, []);

  const handleScroll = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const mcpServers = [
    {
      name: 'elo57',
      category: 'ERP & BANCO DE DADOS',
      description: 'Operações em tempo real no banco PostgreSQL do Elo 57 (Estoque, CRM, Diário de Obra, Financeiro, BIM e Pedidos).',
      icon: faDatabase,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      tools: ['listar_estoque', 'mover_lead_funil', 'lancar_despesa', 'criar_diario_obra', 'consultar_horas_trabalhadas', 'obter_kpis_bim']
    },
    {
      name: 'meta-ads-mcp-server',
      category: 'MARKETING & TRÁFEGO PAGO',
      description: 'Gestão completa do ecossistema Meta (Facebook, Instagram, WhatsApp, Ads e Leads das campanhas).',
      icon: faMeta,
      badgeColor: 'bg-[#F25A2F]/10 text-[#F25A2F] border-[#F25A2F]/30',
      tools: ['meta_create_post', 'meta_get_account_insights', 'meta_get_leadgen_leads', 'meta_publish_instagram_photo', 'threads_publish_text']
    },
    {
      name: 'chrome-devtools-mcp',
      category: 'BROWSER & UI TESTES',
      description: 'Controle direto do navegador para testes visuais, capturas de tela limpas e auditoria de performance.',
      icon: faLaptopCode,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tools: ['take_screenshot', 'lighthouse_audit', 'evaluate_script', 'click', 'fill_form']
    },
    {
      name: 'autodesk-product-help',
      category: 'ENGENHARIA BIM 3D',
      description: 'Consulta rápida de documentação técnica, APIs e especificações de modelos Revit (.rvt) e IFC.',
      icon: faCubes,
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
      tools: ['get_available_products', 'search_help_content']
    },
    {
      name: 'netlify',
      category: 'DEVOPS & DEPLOYS',
      description: 'Controle de deploys em nuvem, variáveis de ambiente (env vars) e métricas de infraestrutura.',
      icon: faServer,
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      tools: ['netlify-project-services-reader', 'netlify-deploy-services-updater', 'netlify-coding-rules']
    },
    {
      name: 'adobe-express-developer',
      category: 'DESIGN & GRÁFICOS',
      description: 'Integração de especificações e typedefs para geração e manipulação de assets visuais.',
      icon: faMagic,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      tools: ['get_typedefinitions', 'get_relevant_documentations']
    }
  ];

  return (
    <div className="relative bg-white font-sans md:snap-y md:snap-mandatory h-auto md:h-screen overflow-y-auto md:overflow-y-scroll scroll-smooth text-slate-900">
      
      {/* Indicadores Laterais Flutuantes (Dots Navigation) */}
      <nav className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-50 hidden sm:flex flex-col gap-4 pointer-events-auto bg-slate-950/80 backdrop-blur-md p-3.5 rounded-full border border-slate-800 shadow-2xl">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => handleScroll(section.id)}
              className="group relative flex items-center justify-center focus:outline-none"
              aria-label={`Ir para ${section.label}`}
            >
              {/* Tooltip Lateral */}
              <span className="absolute right-10 scale-0 group-hover:scale-100 transition-all duration-200 origin-right bg-slate-900 text-white text-xs md:text-sm font-bold tracking-wider uppercase py-2 px-4 rounded-xl whitespace-nowrap shadow-xl pointer-events-none border border-slate-800">
                {section.label}
              </span>
              
              {/* Dot Visual */}
              <span className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                isActive 
                  ? 'bg-[#F25A2F] scale-125 shadow-lg shadow-[#F25A2F]/50 ring-4 ring-[#F25A2F]/20' 
                  : 'bg-slate-500 group-hover:bg-slate-200 group-hover:scale-110'
              }`} />
            </button>
          );
        })}
      </nav>

      {/* ==========================================
          SEÇÃO 1: HERO (CAPA DA APRESENTAÇÃO)
      ========================================== */}
      <section 
        id="hero" 
        className="snap-start relative h-screen flex flex-col items-center justify-center overflow-hidden bg-white px-6 text-center"
      >
        <div className="z-10 flex flex-col items-center max-w-5xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-sm md:text-base font-bold uppercase tracking-widest">
            <FontAwesomeIcon icon={faGraduationCap} className="text-lg text-slate-800" /> Workshop Exclusivo Studio 57 & Elo 57
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-slate-950 tracking-tight leading-none">
            Google <span className="font-light text-slate-800">Antigravity</span> & MCP
          </h1>

          <div className="w-48 border-t-2 border-[#F25A2F] my-2"></div>

          <p className="text-2xl md:text-3xl font-light text-slate-500 tracking-[0.15em] uppercase">
            Eficiência Agêntica em cada detalhe.
          </p>

          <p className="text-lg md:text-2xl text-slate-600 font-light leading-relaxed max-w-3xl">
            Como nossa construtora e incorporadora utiliza IA de última geração para pair programming, automação de obras, marketing e controle do ERP Elo 57 em tempo real.
          </p>

          <div className="flex flex-wrap justify-center gap-4 md:gap-6 pt-4">
            <button 
              onClick={() => handleScroll('overview')}
              className="px-8 py-4 bg-[#F25A2F] hover:bg-[#e04f25] text-white font-bold rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-lg md:text-xl flex items-center gap-3"
            >
              <FontAwesomeIcon icon={faPlay} className="text-base" /> Iniciar Apresentação
            </button>

            <button 
              onClick={() => handleScroll('amanda-finance')}
              className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl shadow-sm hover:shadow transition-all duration-300 cursor-pointer text-lg md:text-xl flex items-center gap-3"
            >
              <FontAwesomeIcon icon={faCalculator} className="text-slate-700" /> Caso Financeiro
            </button>

            <button 
              onClick={() => handleScroll('tools-libraries')}
              className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl shadow-sm hover:shadow transition-all duration-300 cursor-pointer text-lg md:text-xl flex items-center gap-3"
            >
              <FontAwesomeIcon icon={faBoxes} className="text-slate-700" /> Ferramentas Instaladas
            </button>
          </div>
        </div>

        <button 
          onClick={() => handleScroll('overview')}
          className="absolute bottom-10 animate-bounce text-[#F25A2F] focus:outline-none cursor-pointer p-2"
          aria-label="Rolar para baixo"
        >
          <FontAwesomeIcon icon={faChevronDown} className="text-3xl md:text-4xl" />
        </button>
      </section>

      {/* ==========================================
          SEÇÃO 2: O QUE É O ANTIGRAVITY & DEVONILDO
      ========================================== */}
      <section 
        id="overview" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          {/* Coluna Esquerda: Texto */}
          <div className="space-y-8">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Inteligência IA Agêntica
            </span>

            <h2 className="text-4xl md:text-6xl font-light text-slate-900 leading-tight tracking-tight">
              Antigravity: Seu Mentor & <span className="font-bold text-slate-950">Devonildo.</span>
            </h2>

            <p className="text-lg md:text-xl text-slate-600 font-light leading-relaxed">
              O **Google Antigravity** não é um mero gerador de texto. Ele é um **agente autônomo de Pair Programming** que trabalha ativamente dentro do nosso projeto.
            </p>

            <div className="space-y-5 pt-2">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 text-slate-800 flex items-center justify-center flex-shrink-0 text-xl font-bold">
                  <FontAwesomeIcon icon={faTerminal} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg md:text-xl">Execução Direta no Terminal</h3>
                  <p className="text-base text-slate-500 font-light mt-1">Roda servidores locais (`npm run dev`), executa scripts Node.js e instala pacotes sem intervenção manual.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 text-slate-800 flex items-center justify-center flex-shrink-0 text-xl font-bold">
                  <FontAwesomeIcon icon={faMicrochip} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg md:text-xl">Subagentes Autônomos Paralelos</h3>
                  <p className="text-base text-slate-500 font-light mt-1">Dispara subagentes simultâneos de pesquisa, auditoria de código e checagem de erros.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 text-slate-800 flex items-center justify-center flex-shrink-0 text-xl font-bold">
                  <FontAwesomeIcon icon={faWrench} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg md:text-xl">Regras & Persona (.agents)</h3>
                  <p className="text-base text-slate-500 font-light mt-1">Obedece rigorosamente às regras do Studio 57 (Persona Devonildo): testar localmente antes do deploy.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Simulador de Terminal Agêntico */}
          <div className="flex justify-center w-full">
            <div className="w-full max-w-xl bg-slate-950 rounded-3xl p-6 shadow-2xl border border-slate-800 flex flex-col h-[500px]">
              {/* Header do Terminal */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full bg-red-500 inline-block"></span>
                  <span className="w-4 h-4 rounded-full bg-yellow-500 inline-block"></span>
                  <span className="w-4 h-4 rounded-full bg-green-500 inline-block"></span>
                  <span className="ml-2 text-sm md:text-base font-mono text-slate-300 font-bold">antigravity-devonildo@studio57:~$</span>
                </div>
                <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg font-mono font-bold border border-slate-700">ACTIVE AGENT</span>
              </div>

              {/* Logs do Terminal */}
              <div className="flex-grow font-mono text-sm md:text-base space-y-3 overflow-y-auto pr-2 flex flex-col justify-end pb-2">
                {terminalLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log.type === 'info' && <span className="text-slate-400">{log.text}</span>}
                    {log.type === 'success' && <span className="text-emerald-400 font-semibold">{log.text}</span>}
                    {log.type === 'warning' && <span className="text-amber-400 font-semibold">{log.text}</span>}
                    {log.type === 'highlight' && <span className="text-blue-400 font-bold">{log.text}</span>}
                  </div>
                ))}

                {isTypingLog && (
                  <div className="text-slate-400 flex items-center gap-2">
                    <span>&gt; Processando comando</span>
                    <span className="animate-pulse">...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 3: REGRAS, WORKFLOWS, SKILLS & MCP
      ========================================== */}
      <section 
        id="customizations" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Customizações do Sistema
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              Regras, Workflows, <span className="font-bold text-slate-950">Skills e MCP.</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              Como o cérebro da IA é treinado, norteado e equipado para agir com perfeição no Studio 57.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. REGRAS */}
            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-7 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-700 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faBalanceScale} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900">1. Regras (Rules)</h3>
                <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest block mb-2">A Lei Inquebrável</span>
                <p className="text-base text-slate-600 font-light leading-relaxed">
                  Diretrizes de conduta permanentes. A IA obedece <strong>sempre</strong> antes de tocar no código.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-sm text-slate-700 space-y-1 font-medium">
                <p>📍 Onde fica: <span className="font-mono text-xs text-slate-900">.agents/AGENTS.md</span></p>
                <p className="text-xs text-slate-500 italic">&quot;Proibido deploy sem testar no servidor local antes.&quot;</p>
              </div>
            </div>

            {/* 2. WORKFLOWS */}
            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-7 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-700 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faRoute} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900">2. Workflows</h3>
                <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest block mb-2">O Roteiro Passo a Passo</span>
                <p className="text-base text-slate-600 font-light leading-relaxed">
                  Manuais de procedimentos sequenciais para guiar rotinas complexas da empresa.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-sm text-slate-700 space-y-1 font-medium">
                <p>📍 Onde fica: <span className="font-mono text-xs text-slate-900">.agents/workflows/</span></p>
                <p className="text-xs text-slate-500 italic">Comandos: <span className="font-bold text-slate-800">/deploy</span>, <span className="font-bold text-slate-800">/algoritmo-stella</span></p>
              </div>
            </div>

            {/* 3. SKILLS */}
            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-7 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-700 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faBrain} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900">3. Skills (Habilidades)</h3>
                <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest block mb-2">Conhecimento Especial</span>
                <p className="text-base text-slate-600 font-light leading-relaxed">
                  Pacotes modulares com scripts auxiliares ativados dinamicamente sob demanda.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-sm text-slate-700 space-y-1 font-medium">
                <p>📍 Onde fica: <span className="font-mono text-xs text-slate-900">.agents/skills/</span></p>
                <p className="text-xs text-slate-500 italic">Skills: <span className="font-bold text-slate-800">injecao_sql</span>, <span className="font-bold text-slate-800">auditoria_stella</span></p>
              </div>
            </div>

            {/* 4. MCP */}
            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-7 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-700 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faPlug} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900">4. MCP (Protocolo)</h3>
                <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest block mb-2">Braço de Ação Externa</span>
                <p className="text-base text-slate-600 font-light leading-relaxed">
                  O conector que permite à IA alterar o banco PostgreSQL e interagir com APIs externas.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-sm text-slate-700 space-y-1 font-medium">
                <p>📍 Conectores: <span className="font-mono text-xs text-slate-900">6 Servidores MCP</span></p>
                <p className="text-xs text-slate-500 italic">Ferramentas: <span className="font-bold text-slate-800">mover_lead_funil</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 4: DEEP DIVE — O QUE É O MCP?
      ========================================== */}
      <section 
        id="mcp-explain" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Entendendo o MCP a Fundo
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              O que é o <span className="font-bold text-slate-950">MCP (Model Context Protocol)?</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              O padrão aberto que funciona como o <strong>&quot;Cabo USB-C Universal&quot;</strong> conectando a Inteligência Artificial ao banco de dados e sistemas do Studio 57.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-gray-200 rounded-3xl p-8 space-y-4 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-2xl font-bold">
                <FontAwesomeIcon icon={faExchangeAlt} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">1. O Padrão Universal (USB-C)</h3>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Antes do MCP, cada IA precisava de uma integração customizada e frágil. O MCP criou uma **linguagem única**: qualquer modelo de IA se conecta a qualquer banco de dados instantaneamente.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-3xl p-8 space-y-4 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-2xl font-bold">
                <FontAwesomeIcon icon={faNetworkWired} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">2. Arquitetura Cliente-Servidor</h3>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                O **Antigravity (Cliente)** raciocina e decide a ação. O **Servidor MCP** expõe com segurança as ferramentas (**Tools**), recursos (**Resources**) e dados do banco PostgreSQL Supabase.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-3xl p-8 space-y-4 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-2xl font-bold">
                <FontAwesomeIcon icon={faShieldAlt} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">3. Mãos e Olhos Virtuais</h3>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Sem MCP, a IA apenas gera texto na tela. Com MCP, ela **executa ações reais com segurança**: move leads no CRM, agenda postagens no Meta Ads, consulta o estoque e lança despesas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 5: OS 6 SERVIDORES MCP NO ELO 57
      ========================================== */}
      <section 
        id="mcp-servers" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Conectores Ativos
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              Nossos 6 Servidores <span className="font-bold text-slate-950">MCP em Ação.</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              As 6 pontes ativas que dão superpoderes operacionais ao Antigravity dentro do Studio 57.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mcpServers.map((server) => (
              <div key={server.name} className="bg-white rounded-3xl border border-gray-100 hover:border-gray-200 p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                      <FontAwesomeIcon icon={server.icon} />
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${server.badgeColor}`}>
                      {server.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900">{server.name}</h3>
                    <p className="text-base text-slate-500 font-light mt-2 leading-relaxed">{server.description}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Ferramentas Mapeadas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {server.tools.map((tool) => (
                      <span key={tool} className="text-xs font-mono font-medium bg-gray-50 text-slate-700 px-2.5 py-1 rounded-lg border border-gray-200">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 6: CASO PRÁTICO DEDICADO — AMANDA NO FINANCEIRO
      ========================================== */}
      <section 
        id="amanda-finance" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Caso Prático Real #1
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              Antigravity + MCP no Financeiro: <span className="font-bold text-slate-950">O Caso da Amanda.</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              Como a Amanda (nossa gestora financeira) multiplica sua velocidade em <strong>10x</strong> conversando com o Antigravity via comandos simples.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faReceipt} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">1. Lançamento Direto no Banco</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  Amanda pede: <em>&quot;Devonildo, lance a NF #4029 de R$ 15.400 da Concreto Forte para o Residencial Alfa&quot;</em>. O Antigravity executa `elo57/lancar_despesa` com sinal (-) automático.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faSearchDollar} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">2. Auditoria Anti-Erros</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  Amanda solicita audit: O Antigravity faz varredura via `elo57/buscar_lancamentos_financeiros` detectando se alguma despesa foi gravada como receita por engano humano.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faPiggyBank} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">3. Conciliação de Lotes</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  Cruzamento de lotes de antecipação do Sicoob e faturas de cartão de crédito Cachoeira sem ter que conferir linha por linha manualmente no Excel.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faFileInvoiceDollar} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">4. Relatório de Caixa no Chat</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  Amanda pergunta: <em>&quot;Qual o nosso saldo consolidado de contas para sexta-feira?&quot;</em>. O Antigravity compila via `elo57/listar_contas_financeiras` e gera o resumo na tela.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-base">
                    A
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Amanda // Gestora Financeira</h4>
                    <p className="text-xs text-slate-400 font-mono">Chat Direct com Antigravity MCP</p>
                  </div>
                </div>
                <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-bold">FINANCEIRO ELO 57</span>
              </div>

              <div className="space-y-3 text-sm font-sans">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-slate-200">
                  <span className="text-xs font-bold text-slate-400 block mb-1">Amanda:</span>
                  <p>&quot;Devonildo, lance a despesa de R$ 8.500 do frete da estrutura metálica da obra Alfa, conta Itaú, para hoje.&quot;</p>
                </div>

                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-slate-100 space-y-2">
                  <span className="text-xs font-bold text-blue-400 block">Antigravity (Devonildo):</span>
                  <p className="text-xs font-mono text-blue-300">&gt; Executando MCP tool elo57/lancar_despesa(valor: -8500, obra_id: 12)...</p>
                  <p className="font-bold text-emerald-400">✅ Lançamento realizado com sucesso!</p>
                  <p className="text-xs text-slate-300">Despesa de -R$ 8.500,00 registrada na conta Itaú (Org ID #1). Saldo atualizado em tempo real no dashboard do Elo 57.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 7: CASO PRÁTICO DEDICADO — SISTEMA BIM, QUANTITATIVOS & ORÇAMENTO
      ========================================== */}
      <section 
        id="bim-engineering" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Caso Prático Real #2
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              Antigravity + MCP no BIM 5D: <span className="font-bold text-slate-950">Quantitativos & Orçamento.</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              Como a engenharia extrai materiais de modelos 3D Revit/IFC e gera o orçamento e o cronograma da obra sem trabalho braçal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faObjectGroup} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">1. Consulta do Modelo 3D</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  O Antigravity varre os modelos 3D via MCP `elo57/listar_elementos_por_categoria` e `elo57/listar_modelos_bim`, identificando cada pilar, viga e parede.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faRulerCombined} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">2. Take-off 5D de Quantitativos</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  Extração automática de m³ de concreto, m² de alvenaria e kg de aço via `elo57/consultar_quantitativo_propriedades` e `elo57/obter_kpis_bim`.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faCoins} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">3. Orçamentação Automática</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  A IA cruza as quantidades do BIM com as cotações do almoxarifado via MCP `elo57/adicionar_item_orcamento`, montando a folha de orçamento.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">4. Planejamento 4D & Compras</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">
                  O Antigravity alinha as fases construtivas do 3D ao cronograma de suprimentos via MCP `elo57/criar_fase_pedido`, agendando as compras da obra.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-base">
                    E
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Engenharia de Custos // BIM Manager</h4>
                    <p className="text-xs text-slate-400 font-mono">Chat Direct com Antigravity MCP</p>
                  </div>
                </div>
                <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-bold">BIM 5D ELO 57</span>
              </div>

              <div className="space-y-3 text-sm font-sans">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-slate-200">
                  <span className="text-xs font-bold text-slate-400 block mb-1">Engenheiro:</span>
                  <p>&quot;Devonildo, extraia o volume de concreto do Bloco A do modelo Revit e monte a planilha de orçamento de estrutura.&quot;</p>
                </div>

                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-slate-100 space-y-2">
                  <span className="text-xs font-bold text-blue-400 block">Antigravity (Devonildo):</span>
                  <p className="text-xs font-mono text-blue-300">&gt; Executando elo57/consultar_quantitativo_propriedades (modelo: #8, cat: Concreto)...</p>
                  <p className="font-bold text-emerald-400">📊 Quantitativo BIM 5D Extraído:</p>
                  <ul className="text-xs text-slate-300 space-y-1 font-mono">
                    <li>• Concreto Usinado Fck 30MPa: 420.5 m³</li>
                    <li>• Aço CA-50 (10mm e 12.5mm): 38.400 kg</li>
                    <li>• Forma Plastificada: 1.840 m²</li>
                  </ul>
                  <p className="text-xs text-emerald-400 font-bold mt-1">✅ 3 itens vinculados à tabela de orçamento da obra com sucesso!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 8: ARQUITETURA DO ELO 57
      ========================================== */}
      <section 
        id="architecture" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Engenharia de Software
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              Arquitetura <span className="font-bold text-slate-950">Escalável & Multi-Tenant.</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              O Elo 57 é construído para velocidade extrema, segurança por RLS e isolamento total entre empresas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-6 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faProjectDiagram} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Next.js 15 App Router</h3>
                <p className="text-base text-slate-500 font-light mt-2 leading-relaxed">
                  Roteamento Server e Client Components em `app/(main)` com renderização otimizada.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 block">Frontend Framework</span>
            </div>

            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-6 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faDatabase} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Supabase + PostgreSQL</h3>
                <p className="text-base text-slate-500 font-light mt-2 leading-relaxed">
                  Políticas RLS (`organizacao_id`), Triggers automáticos e RPCs nativas em PL/pgSQL.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 block">Database & RLS</span>
            </div>

            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-6 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faLayerGroup} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Tailwind CSS + Design System</h3>
                <p className="text-base text-slate-500 font-light mt-2 leading-relaxed">
                  Interface Padrão Ouro conforme `DESIGN_SYSTEM.md`, com foco em clareza visual.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 block">Design & UI</span>
            </div>

            <div className="border border-gray-100 hover:border-gray-200 rounded-3xl p-6 bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-2xl font-bold mb-4">
                  <FontAwesomeIcon icon={faBolt} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">TanStack Query v5</h3>
                <p className="text-base text-slate-500 font-light mt-2 leading-relaxed">
                  Cache em background com carregamento mágico e revalidação inteligente.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 block">State & Cache</span>
            </div>
          </div>

          <div className="bg-slate-950 text-gray-100 rounded-3xl p-6 font-mono text-sm md:text-base overflow-x-auto border border-slate-800 shadow-2xl space-y-1.5">
            <p className="text-emerald-400 font-bold mb-2">// Estrutura Canônica de Diretórios — Studio 57</p>
            <p>c:/Projetos/studio57so-v8/</p>
            <p>├── <span className="text-amber-300 font-bold">.agents/</span>                  <span className="text-slate-400"># Regras, Workflows de IA e Manuais (.md)</span></p>
            <p>├── <span className="text-blue-400 font-bold">app/</span>                     <span className="text-slate-400"># Next.js App Router ((main), (landingpages), (bim))</span></p>
            <p>├── <span className="text-purple-400 font-bold">components/</span>              <span className="text-slate-400"># Componentes reutilizáveis (shared/, ui/, crm/)</span></p>
            <p>├── <span className="text-cyan-400 font-bold">contexts/</span>                <span className="text-slate-400"># Contextos globais (AuthContext, LayoutContext)</span></p>
            <p>└── <span className="text-green-400 font-bold">supabase/</span>               <span className="text-slate-400"># Migrações de banco e funções (RPCs)</span></p>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 9: BIBLIOTECAS & MÍDIA INSTALADAS NO PROJETO (REESTRUTURADA COM PACKAGE.JSON)
      ========================================== */}
      <section 
        id="tools-libraries" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Poder do Repositório (package.json)
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              Bibliotecas & <span className="font-bold text-slate-950">Ferramentas Instaladas.</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              As bibliotecas que instalamos no sistema para transformar PDFs em imagens, gerar vídeos React, criar tours 360° e turbinar a IA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. PDF2PIC + PDF-LIB */}
            <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faFilePdf} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl">PDF em Imagens & Leitura</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">pdf2pic // pdf-lib // pdf-parse</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Converte páginas de contratos PDF em imagens PNG/JPG para visualização rápida e permite ao Antigravity ler e extrair cláusulas e valores de PDFs escaneados.
              </p>
            </div>

            {/* 2. REMOTION */}
            <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faVideo} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl">Remotion (Vídeo React)</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">remotion // @remotion/player</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Transforma componentes JSX React em vídeos MP4 de 60 FPS com animações suaves e renderização FFmpeg para anúncios do Meta Ads.
              </p>
            </div>

            {/* 3. UPPY + GOLDENRETRIEVER */}
            <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faCloudUploadAlt} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl">Upload Anti-Crash</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">@uppy/golden-retriever // tus</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Uploads resilientes com salvamento automático em cache local. Se a conexão de internet da obra cair, o envio do arquivo pesado é retomado sem perdas.
              </p>
            </div>

            {/* 4. AUTODESK APS */}
            <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faCubes} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl">Autodesk APS (Forge)</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">@aps_sdk/model-derivative</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Processamento e conversão de arquivos Revit (.rvt) e IFC diretamente na nuvem da Autodesk para visualização BIM 3D web.
              </p>
            </div>

            {/* 5. TOUR VIRTUAL 360° */}
            <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faCompass} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl">Tour Virtual 360°</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">@photo-sphere-viewer/core</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Visualizador de imagens esféricas 360° para acompanhar o avanço mensal das obras e apresentar apartamentos decorados aos clientes.
              </p>
            </div>

            {/* 6. PLAYWRIGHT & FIRECRAWL */}
            <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center text-xl font-bold">
                  <FontAwesomeIcon icon={faGlobe} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl">Scraping & Browser E2E</h3>
                  <span className="text-xs font-mono font-bold text-slate-400">playwright // firecrawl-js</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Automação de navegador para capturar screenshots de alta qualidade sem overlays e buscar informações atualizadas na web.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 10: MAIS CASOS PRÁTICOS NO STUDIO 57
      ========================================== */}
      <section 
        id="cases" 
        className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white text-slate-900 px-6 py-16 md:py-0 overflow-hidden border-t border-gray-100"
      >
        <div className="max-w-7xl mx-auto w-full space-y-10">
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <span className="text-slate-400 font-bold tracking-widest uppercase text-sm md:text-base block">
              Mais Casos Práticos
            </span>
            <h2 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight">
              Aceleração em <span className="font-bold text-slate-950">Todas as Áreas.</span>
            </h2>
            <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed">
              Exemplos práticos de como a união entre Antigravity e MCP transforma a produtividade no Studio 57.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-gray-200 rounded-3xl p-7 bg-white shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center font-bold text-xl">
                  <FontAwesomeIcon icon={faBullhorn} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl md:text-2xl">1. SDR Stella IA 24h & Funil Comercial</h3>
                  <span className="text-xs font-bold text-slate-400 uppercase">Comercial + WhatsApp</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Qualificação BANT automática dos leads no WhatsApp e movimentação dos cards de fase no Funil de Vendas Supabase via MCP `elo57/mover_lead_funil`.
              </p>
            </div>

            <div className="border border-gray-200 rounded-3xl p-7 bg-white shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center font-bold text-xl">
                  <FontAwesomeIcon icon={faBuilding} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl md:text-2xl">2. Diário de Obra (RDO) & BIM</h3>
                  <span className="text-xs font-bold text-slate-400 uppercase">Engenharia & Campo</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Lançamento de atividades diárias de obra e sincronização de avanço físico de modelos BIM via MCP `elo57/criar_diario_obra`.
              </p>
            </div>

            <div className="border border-gray-200 rounded-3xl p-7 bg-white shadow-md space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center font-bold text-xl">
                  <FontAwesomeIcon icon={faMeta} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl md:text-2xl">3. Gestão de Anúncios no Meta Ads</h3>
                  <span className="text-xs font-bold text-slate-400 uppercase">Marketing & Tráfego</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Extração de métricas de CPL e publicação de novos posts no Instagram/Facebook do empreendimento via MCP `meta-ads-mcp-server`.
              </p>
            </div>

            <div className="border border-gray-200 rounded-3xl p-7 bg-white shadow-md space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-800 flex items-center justify-center font-bold text-xl">
                  <FontAwesomeIcon icon={faChartLine} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl md:text-2xl">4. RH & Ponto Eletrônico de Obras</h3>
                  <span className="text-xs font-bold text-slate-400 uppercase">Recursos Humanos</span>
                </div>
              </div>
              <p className="text-base text-slate-600 font-light leading-relaxed">
                Lançamento de registros de ponto e horas trabalhadas dos funcionários em canteiros via MCP `elo57/lancar_ponto_funcionario`.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SEÇÃO 11: CONCLUSÃO / CTA
      ========================================== */}
      <section 
        id="cta" 
        className="snap-start relative h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950 text-white px-6 text-center"
      >
        <div className="z-10 flex flex-col items-center max-w-4xl mx-auto space-y-8">
          <span className="px-4 py-2 rounded-full bg-slate-800 text-slate-300 font-mono text-sm font-bold uppercase tracking-widest border border-slate-700">
            Studio 57 / Elo 57 — 2026
          </span>

          <h2 className="text-5xl md:text-7xl font-light text-white tracking-tight leading-tight">
            Transformando o Studio 57 na Construtora <span className="font-bold text-slate-100">Mais Inteligente do Brasil.</span>
          </h2>

          <p className="text-slate-300 text-lg md:text-2xl font-light leading-relaxed max-w-2xl">
            A combinação entre **Antigravity, Elo 57, Customizações e MCP** coloca nossa empresa na vanguarda do mercado imobiliário e da construção civil.
          </p>

          <div className="flex flex-wrap justify-center gap-6 pt-6">
            <button 
              onClick={() => handleScroll('hero')}
              className="px-10 py-5 bg-[#F25A2F] hover:bg-[#e04f25] text-white font-bold rounded-2xl shadow-2xl transition-all duration-300 cursor-pointer text-lg md:text-xl"
            >
              Voltar ao Início da Apresentação
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
