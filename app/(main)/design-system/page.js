// app/(main)/design-system/page.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faEdit, faTrash, faCopy, faEye, faSearch, faTimes,
  faFilter, faCheck, faSpinner, faInfoCircle, faCheckCircle,
  faExclamationTriangle, faCalendarDay, faClock, faColumns,
  faBookOpen, faCode, faWindowMaximize,
  faPhone, faUserTie, faGlobe, faUser, faTag, faCalendarAlt,
  faTruck, faDollarSign, faFileInvoiceDollar, faEllipsisV,
  faHome, faTasks, faClipboardList, faChevronDown, faChevronUp,
  faSave, faEyeSlash, faBrain, faClone, faFileInvoice,
  faTable, faChevronRight, faArrowUp, faArrowDown, faSort
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faFacebook, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';

export default function DesignSystemPage() {
  const [copiedText, setCopiedText] = useState('');
  
  // Estados para simulação de busca de contato
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedContato, setSelectedContato] = useState(null);
  
  // Estados interativos simulados
  const [simulatedRegime, setSimulatedRegime] = useState('caixa');
  const [simulatedTipo, setSimulatedTipo] = useState('receita');
  const [simulatedToggle, setSimulatedToggle] = useState(true);
  const [currencyValue, setCurrencyValue] = useState('0,00');
  const [activeSection, setActiveSection] = useState('botoes');
  
  // Estado de ordenação simulado para a Tabela de Vendas
  const [sortField, setSortField] = useState('unidade');
  const [sortAsc, setSortAsc] = useState(true);

  // Contatos fictícios para simulação de busca
  const contatosDemo = [
    { id: 1, nome: "Ranniere Campos (seu lindo)", tipo: "Cliente", telefone: "(33) 99191-2291" },
    { id: 2, nome: "Stella IA SDR 2.0", tipo: "Parceiro", telefone: "IA Oficial" },
    { id: 3, nome: "Construtora Studio 57 Matriz", tipo: "Fornecedor", telefone: "(31) 3224-5757" },
    { id: 4, nome: "Almoxarifado Geral de Obras", tipo: "Parceiro", telefone: "Interno" }
  ];

  const filteredContatos = contatosDemo.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dados reais para a Tabela de Vendas simulada
  const unidadesDemo = [
    { unidade: "201", tipo: "Unidade Habitacional", area: "30.72 m²", status: "Disponível", valor: 257255.42 },
    { unidade: "202", tipo: "Unidade Habitacional", area: "35.50 m²", status: "Vendido", valor: 298500.00 },
    { unidade: "301", tipo: "Cobertura Premium", area: "62.40 m²", status: "Disponível", valor: 545000.00 }
  ];

  const sortedUnidades = [...unidadesDemo].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Monitorar rolagem de tela para o Scroll Spy na Sidebar
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['botoes', 'formularios', 'tabelas', 'cards', 'kpis', 'modais', 'icones', 'tipografia'];
      const scrollPosition = window.scrollY + window.innerHeight / 3;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  const handleCurrencyChange = (e) => {
    let cleanValue = e.target.value.replace(/\D/g, '');
    if (!cleanValue) {
      setCurrencyValue('0,00');
      return;
    }
    let floatValue = parseFloat(cleanValue) / 100;
    setCurrencyValue(new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(floatValue));
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`Snippet de ${label} copiado!`);
    setTimeout(() => setCopiedText(''), 2000);
  };

  // Dicionário de ícones padrão do ERP para o catálogo interativo
  const bibliotecaIcones = [
    {
      categoria: "Ações de CRUD (Tabelas e Cadastros)",
      items: [
        { name: "faEdit", icon: faEdit, label: "Editar Registro", desc: "Ação de alteração. Obrigatoriamente usado em botões de edição de linhas e formulários. Proibido faPen/faPencilAlt.", code: "<FontAwesomeIcon icon={faEdit} />" },
        { name: "faTrash", icon: faTrash, label: "Excluir Registro", desc: "Exclusão permanente de dados em tabelas ou formulários. Proibido faTrashAlt.", code: "<FontAwesomeIcon icon={faTrash} />" },
        { name: "faPlus", icon: faPlus, label: "Novo / Adicionar", desc: "Ação primária de criação de registros no topo das páginas de listagem.", code: "<FontAwesomeIcon icon={faPlus} />" },
        { name: "faSave", icon: faSave, label: "Salvar Alterações", desc: "Botão de confirmação de cadastro em formulários e modais.", code: "<FontAwesomeIcon icon={faSave} />" },
        { name: "faTimes", icon: faTimes, label: "Fechar / Cancelar", desc: "Fechar modais ou cancelar edições em andamento. Proibido faXmark.", code: "<FontAwesomeIcon icon={faTimes} />" },
        { name: "faCopy", icon: faCopy, label: "Duplicar / Copiar", desc: "Duplicação de registros ou cópia de chaves pix/tokens comerciais.", code: "<FontAwesomeIcon icon={faCopy} />" }
      ]
    },
    {
      categoria: "Navegação e Pesquisa",
      items: [
        { name: "faSearch", icon: faSearch, label: "Buscar / Pesquisar", desc: "Campos de autocomplete, barras de busca globais e inputs de filtro.", code: "<FontAwesomeIcon icon={faSearch} />" },
        { name: "faFilter", icon: faFilter, label: "Filtrar Resultados", desc: "Botão secundário de acionamento de filtros suspensos in listagens.", code: "<FontAwesomeIcon icon={faFilter} />" },
        { name: "faEye", icon: faEye, label: "Visualizar Detalhes", desc: "Botão de detalhamento, histórico ou auditoria de linhas.", code: "<FontAwesomeIcon icon={faEye} />" },
        { name: "faChevronDown", icon: faChevronDown, label: "Expandir Menu", desc: "Menus colapsáveis (Accordion) ou indicadores de dropdown.", code: "<FontAwesomeIcon icon={faChevronDown} />" },
        { name: "faChevronUp", icon: faChevronUp, label: "Recolher Menu", desc: "Menus colapsáveis (Accordion) recolhidos.", code: "<FontAwesomeIcon icon={faChevronUp} />" }
      ]
    },
    {
      categoria: "Mensagens e Status",
      items: [
        { name: "faWhatsapp", icon: faWhatsapp, label: "Ação WhatsApp", desc: "Disparo de mensagens comerciais ou transbordo da Stella IA.", code: "<FontAwesomeIcon icon={faWhatsapp} />" },
        { name: "faPhone", icon: faPhone, label: "Contato Telefônico", desc: "Indicação de telefone de contato de cliente ou corretor.", code: "<FontAwesomeIcon icon={faPhone} />" },
        { name: "faCheckCircle", icon: faCheckCircle, label: "Status Concluído", desc: "Indicação de faturamento, conciliação realizada ou sucesso.", code: "<FontAwesomeIcon icon={faCheckCircle} />" },
        { name: "faExclamationTriangle", icon: faExclamationTriangle, label: "Status Alerta", desc: "Contas pendentes, atrasos ou avisos de auditoria.", code: "<FontAwesomeIcon icon={faExclamationTriangle} />" },
        { name: "faInfoCircle", icon: faInfoCircle, label: "Ajuda / Informação", desc: "Tooltips e caixas informativas sobre regras de banco ou do sistema.", code: "<FontAwesomeIcon icon={faInfoCircle} />" },
        { name: "faSpinner", icon: faSpinner, label: "Carregando (Loading)", desc: "Transações em background. Sempre deve vir com a propriedade spin={true}.", code: "<FontAwesomeIcon icon={faSpinner} spin={true} />" }
      ]
    }
  ];

  return (
    <div className="w-full px-6 py-6 space-y-8 animate-in fade-in duration-500">
      
      {/* Cabeçalho Limpo e Minimalista */}
      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">
            Design System &amp; Styleguide
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Manual estético de componentes, raios de borda e especificações técnicas de banco de dados do ERP.
          </p>
        </div>
        <button 
          onClick={() => toast.success("Diretrizes visuais homologadas localmente!")}
          className="bg-black hover:bg-gray-955 text-white font-bold py-2 px-4 rounded-lg shadow-sm text-xs uppercase tracking-wider transition-all"
        >
          Homologar Diretrizes
        </button>
      </div>

      {/* Grid Layout Fluido de 4 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Sidebar Lateral de Navegação (Design Oficial do ERP com Destaque no Preto Sóbrio) */}
        <aside className="lg:col-span-1 sticky top-6 bg-white py-4 rounded-lg border border-gray-100 shadow-sm print:hidden">
          <h3 className="px-6 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Seções do ERP
          </h3>
          <ul className="space-y-1">
            {[
              { id: 'botoes', label: 'Botões & Flags', icon: faPlus },
              { id: 'formularios', label: 'Formulários & Busca', icon: faSearch },
              { id: 'tabelas', label: 'Tabelas & Listagens', icon: faTable },
              { id: 'cards', label: 'Kanban & Cards', icon: faColumns },
              { id: 'kpis', label: 'KPIs & Métricas', icon: faClipboardList },
              { id: 'modais', label: 'Modais & Alertas', icon: faWindowMaximize },
              { id: 'icones', label: 'Biblioteca de Ícones', icon: faCode },
              { id: 'tipografia', label: 'Tipografia & Cores', icon: faBookOpen }
            ].map((sec) => (
              <li key={sec.id}>
                <button
                  onClick={() => scrollToSection(sec.id)}
                  className={`w-full flex items-center py-3 px-6 transition-all duration-250 border-l-4 ${
                    activeSection === sec.id
                      ? 'bg-gray-100 text-black border-black font-semibold'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-black'
                  }`}
                >
                  <FontAwesomeIcon icon={sec.icon} className={`text-lg w-6 flex-shrink-0 ${activeSection === sec.id ? 'text-black' : 'text-gray-400'}`} />
                  <span className="ml-4 text-sm font-medium">{sec.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conteúdo Principal de Documentação (Fluido) */}
        <div className="lg:col-span-3 space-y-20">
          
          {/* ========================================================================= */}
          {/* SEÇÃO 01: BOTÕES, CRUD E FLAGS */}
          {/* ========================================================================= */}
          <section id="botoes" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">01</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Botões, CRUD e Flags</h2>
                <p className="text-xs text-gray-500">Componentes de ação, acionadores rápidos de tabelas, toggles e flags booleanas.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
              {/* Demonstração Visual */}
              <div className="xl:col-span-2 bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-8">
                <h2 className="text-sm font-bold text-gray-900 border-b pb-3">Demonstração Interativa</h2>
                
                {/* Botões Principais */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Botões de Ação de Tela</h3>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-1.5 uppercase">Primário (Preto Sóbrio)</span>
                      <button className="bg-black hover:bg-gray-900 text-white font-bold py-2.5 px-5 rounded-lg shadow-sm text-sm transition-all flex items-center gap-2 active:scale-95">
                        <FontAwesomeIcon icon={faPlus} /> Adicionar Item
                      </button>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-1.5 uppercase">Secundário (Contornado)</span>
                      <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-2.5 px-5 rounded-lg shadow-sm text-sm transition-all flex items-center gap-2 active:scale-95">
                        <FontAwesomeIcon icon={faFilter} /> Filtrar Lista
                      </button>
                    </div>
                  </div>
                </div>

                {/* Botões CRUD para Linhas de Tabelas */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ações Rápidas ( CRUD em Tabelas )</h3>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Amostra de Linha de Dados</span>
                    <div className="flex items-center gap-3">
                      <button className="text-blue-600 hover:text-blue-800 p-1 text-sm transition-colors" title="Visualizar Detalhes">
                        <FontAwesomeIcon icon={faEye} />
                      </button>
                      <button className="text-gray-500 hover:text-black p-1 text-sm transition-colors" title="Editar Registro">
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button className="text-green-600 hover:text-green-800 p-1 text-sm transition-colors" title="Duplicar">
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                      <div className="h-4 w-px bg-gray-200"></div>
                      <button className="text-red-500 hover:text-red-700 p-1 text-sm transition-colors" title="Excluir">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    <span><strong>Regra Suprema:</strong> Botões de Edição devem usar obrigatoriamente <code>faEdit</code> em vez de <code>faPen</code>.</span>
                  </div>
                </div>

                {/* Alternadores Segmentados (Segmented Controls) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Alternadores Segmentados (Segmented Controls)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Variação A: Com Ícone e Texto */}
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-2 uppercase">Variação A: Com Ícone e Texto</span>
                      <div className="inline-flex bg-gray-100 p-1 rounded-lg items-center h-[42px] border border-gray-200 select-none">
                        <button
                          type="button"
                          onClick={() => setSimulatedRegime('caixa')}
                          className={`px-3.5 h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                            simulatedRegime === 'caixa' 
                              ? 'bg-white text-black shadow-sm border border-gray-200/50' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <FontAwesomeIcon icon={faCalendarDay} />
                          <span>Opção 1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimulatedRegime('competencia')}
                          className={`px-3.5 h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                            simulatedRegime === 'competencia' 
                              ? 'bg-white text-black shadow-sm border border-gray-200/50' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <FontAwesomeIcon icon={faClock} />
                          <span>Opção 2</span>
                        </button>
                      </div>
                    </div>

                    {/* Variação B: Apenas Texto */}
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-2 uppercase">Variação B: Apenas Texto</span>
                      <div className="inline-flex bg-gray-100 p-1 rounded-lg items-center h-[42px] border border-gray-200 select-none">
                        <button className="px-3.5 h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-white text-black shadow-sm border border-gray-200/50">
                          Texto A
                        </button>
                        <button className="px-3.5 h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider rounded-lg text-gray-500 hover:text-gray-700">
                          Texto B
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggles, Checkbox e Flags Booleanas */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Booleanos, Toggles e Flags</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Opções e Booleanos */}
                    <div className="space-y-3">
                      <label className="block text-[10px] text-gray-400 font-bold uppercase">Configurações e Flags</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-700">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black accent-black" defaultChecked />
                          <span>Faturado automaticamente</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-700">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black accent-black" />
                          <span>Requer conciliação manual</span>
                        </label>
                      </div>
                    </div>

                    {/* Toggle Switch Interativo */}
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-2.5">Status da Operação</label>
                      <div className="flex items-center gap-3">
                        <button 
                          type="button"
                          onClick={() => setSimulatedToggle(!simulatedToggle)}
                          className={`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                            simulatedToggle ? 'bg-black' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            simulatedToggle ? 'translate-x-5' : 'translate-x-1'
                          }`} />
                        </button>
                        <span className="text-xs font-bold text-gray-700">
                          {simulatedToggle ? 'Registro Ativo' : 'Registro Inativo'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Código Fonte do Padrão */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Código de Referência</h2>
                  <button 
                    onClick={() => copyToClipboard(
`// Botão Primário (Preto Sóbrio)
<button className="bg-black hover:bg-gray-900 text-white font-bold py-2.5 px-5 rounded-lg shadow-sm text-sm transition-all flex items-center gap-2 active:scale-95">
  <FontAwesomeIcon icon={faPlus} />
  Adicionar Item
</button>

// Alternador de Visão (Segmented Control)
<div className="inline-flex bg-gray-100 p-1 rounded-lg items-center h-[42px] border border-gray-200">
  <button className="px-4 h-full bg-white text-black shadow-sm border rounded-lg text-xs font-bold uppercase">
    Opção 1
  </button>
  <button className="px-4 h-full text-gray-500 hover:text-gray-700 text-xs font-bold uppercase">
    Opção 2
  </button>
</div>

// Toggle Switch Interativo
<button 
  onClick={() => setEnabled(!enabled)}
  className={\`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors \${enabled ? 'bg-black' : 'bg-gray-300'}\`}
>
  <span className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform \${enabled ? 'translate-x-5' : 'translate-x-1'}\`} />
</button>`, 'Botões')}
                    className="text-xs text-gray-500 hover:text-black font-semibold flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faCode} /> Copiar
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto flex-1 font-mono leading-relaxed font-semibold">
{`// Botão Primário:
bg-black hover:bg-gray-955 text-white font-bold py-2.5 px-5 rounded-lg shadow-sm text-sm transition-all

// Botão Secundário:
bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-2.5 px-5 rounded-lg shadow-sm text-sm transition-all

// CRUD em Linha de Tabela (Editar padrão ouro):
<button className="text-gray-500 hover:text-black p-1 transition-colors" title="Editar">
  <FontAwesomeIcon icon={faEdit} />
</button>

// Alternador de Visão (Segmented Control):
<div className="inline-flex bg-gray-100 p-1 rounded-lg items-center h-[42px] border border-gray-200">
  <button className="px-4 h-full bg-white text-black shadow-sm border rounded-lg text-xs font-bold uppercase">
    Opção 1
  </button>
  <button className="px-4 h-full text-gray-500 hover:text-gray-700 text-xs font-bold uppercase">
    Opção 2
  </button>
</div>`}
                </pre>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SEÇÃO 02: FORMULÁRIOS E BUSCA */}
          {/* ========================================================================= */}
          <section id="formularios" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">02</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Formulários e Busca</h2>
                <p className="text-xs text-gray-500">Simulação de formulário completo, seleção de datas sem fuso horário e widget de calendário.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
              {/* Demonstração Visual: Formulário Completo */}
              <div className="xl:col-span-2 bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
                <h2 className="text-sm font-bold text-gray-900 border-b pb-3">Formulário Completo e Busca por Período</h2>
                
                <div className="space-y-6">
                  {/* Tipo de Registro (Receita/Despesa) */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Tipo de Registro (Cores Semânticas de Entrada/Saída)
                    </label>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setSimulatedTipo('receita')}
                        className={`px-4.5 py-2 text-xs font-bold rounded-lg border transition-all active:scale-95 ${
                          simulatedTipo === 'receita'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Receita (+)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSimulatedTipo('despesa')}
                        className={`px-4.5 py-2 text-xs font-bold rounded-lg border transition-all active:scale-95 ${
                          simulatedTipo === 'despesa'
                            ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Despesa (-)
                      </button>
                    </div>
                  </div>

                  {/* Grid de Inputs Básicos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Descrição */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Título ou Descrição do Lançamento
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: Compra de cimento CP-II..." 
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all bg-gray-50/50"
                      />
                    </div>

                    {/* Valor Monetário com Máscara */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex justify-between">
                        <span>Valor Previsto</span>
                        <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Máscara Inteligente</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 text-xs font-bold pointer-events-none">
                          R$
                        </span>
                        <input 
                          type="text" 
                          value={currencyValue}
                          onChange={handleCurrencyChange}
                          placeholder="0,00" 
                          className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-right font-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all bg-gray-50/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dropdown/Autocomplete Simulado */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex justify-between">
                      <span>Vincular Contato</span>
                      <span className="text-[9px] text-gray-400">Autocomplete Interativo</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 text-sm pointer-events-none">
                        <FontAwesomeIcon icon={faSearch} />
                      </span>
                      <input 
                        type="text" 
                        value={selectedContato ? selectedContato.nome : searchTerm}
                        onChange={(e) => {
                          setSelectedContato(null);
                          setSearchTerm(e.target.value);
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Pesquise por nome, tipo ou telefone..." 
                        className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all bg-gray-50/50"
                      />
                      {(searchTerm || selectedContato) && (
                        <button 
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedContato(null);
                            setShowDropdown(false);
                          }}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-black transition-colors"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      )}
                    </div>

                    {showDropdown && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto divide-y divide-gray-100">
                        {filteredContatos.length > 0 ? (
                          filteredContatos.map((contato) => (
                            <div 
                              key={contato.id} 
                              onClick={() => {
                                setSelectedContato(contato);
                                setShowDropdown(false);
                              }}
                              className="p-3 text-sm hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors"
                            >
                              <div>
                                <p className="font-bold text-gray-800 text-xs">{contato.nome}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{contato.telefone}</p>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg border">
                                {contato.tipo}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-gray-400">Nenhum contato encontrado.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Seleção de Datas */}
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Seleção de Datas & Filtro de Intervalo</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Data de Vencimento
                        </label>
                        <input type="date" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all bg-gray-50/50 font-bold" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Data Início
                        </label>
                        <input type="date" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all bg-gray-50/50 font-bold" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Data Fim
                        </label>
                        <input type="date" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all bg-gray-50/50 font-bold" />
                      </div>
                    </div>
                  </div>

                  {/* Datepicker Calendário */}
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Widget de Calendário Unificado</h3>
                    
                    <div className="max-w-md mx-auto border border-gray-200 rounded-lg shadow-md overflow-hidden bg-white">
                      <div className="bg-black text-white p-3.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                        <span>Julho 2026</span>
                        <div className="flex gap-2">
                          <button className="hover:text-gray-300 px-1">&larr;</button>
                          <button className="hover:text-gray-300 px-1">&rarr;</button>
                        </div>
                      </div>

                      <div className="flex">
                        <div className="w-1/3 border-r border-gray-100 p-2.5 flex flex-col gap-1.5 bg-gray-50/50">
                          <button className="text-left text-xs font-bold p-2 rounded-lg bg-black text-white shadow-sm">Hoje</button>
                          <button className="text-left text-xs font-semibold p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-black">Ontem</button>
                          <button className="text-left text-xs font-semibold p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-black">Últimos 7 dias</button>
                          <button className="text-left text-xs font-semibold p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-black">Este Mês</button>
                        </div>

                        <div className="w-2/3 p-3 text-center">
                          <div className="grid grid-cols-7 gap-1 text-[9px] font-black text-gray-400 uppercase mb-2">
                            <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-xs">
                            {Array.from({ length: 31 }, (_, i) => {
                              const dia = i + 1;
                              const isSelected = dia >= 15 && dia <= 20;
                              const isBoundary = dia === 15 || dia === 20;
                              return (
                                <button 
                                  key={dia}
                                  className={`h-6 w-full rounded flex items-center justify-center font-semibold transition-all ${
                                    isBoundary 
                                      ? 'bg-black text-white shadow font-bold' 
                                      : isSelected 
                                        ? 'bg-gray-100 text-black rounded-none' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {dia}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Observações Internas
                    </label>
                    <textarea rows="3" placeholder="Adicione anotações..." className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all bg-gray-50/50" />
                  </div>
                </div>
              </div>

              {/* Especificações */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col h-full justify-between">
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Especificações Técnicas</h2>
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fuso Horário (String)</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Datas de pesquisa devem transitar como <strong>String (YYYY-MM-DD)</strong> no banco para evitar reduções de fuso horário local.
                    </p>
                  </div>

                  <pre className="bg-gray-900 text-gray-200 p-3.5 rounded-lg text-xs font-mono overflow-x-auto font-semibold">
{`const formatarDataLocal = (dateStr) => {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('-');
  return \`\${dia}/\${mes}/\${ano}\`;
};`}
                  </pre>

                  <div className="space-y-2 border-t pt-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Moeda e Decimal</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Inputs pt-BR (vírgula) devem ser convertidos para float contendo ponto decimal antes do envio.
                    </p>
                  </div>

                  <pre className="bg-gray-900 text-gray-200 p-3.5 rounded-lg text-xs font-mono overflow-x-auto font-semibold">
{`export const parseCurrency = (str) => {
  if (!str) return 0;
  const clean = str.replace(/\\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};`}
                  </pre>
                </div>
                <div className="pt-4 border-t mt-4">
                  <button 
                    onClick={() => copyToClipboard('// Ver página de design system para códigos', 'Data & Moeda')}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faCode} /> Copiar Código Auxiliar
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SEÇÃO 03: TABELAS E LISTAGENS */}
          {/* ========================================================================= */}
          <section id="tabelas" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">03</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Tabelas e Listagens</h2>
                <p className="text-xs text-gray-500">Padrão Ouro de cabeçalhos, títulos de seção e linhas de dados de listagens de ERP.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
              {/* Demonstração Tabela */}
              <div className="xl:col-span-2 bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
                
                {/* Cabeçalho da Seção/Tabela */}
                <div className="flex justify-between items-center pb-2.5">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Tabela de Vendas
                  </h3>
                  <button className="text-xs font-bold text-gray-550 hover:text-black transition-colors flex items-center gap-1">
                    Gerenciar Produtos e Condições <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                  </button>
                </div>

                {/* Contêiner da Tabela */}
                <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm bg-white">
                  <table className="min-w-full divide-y divide-gray-200 table-auto">
                    {/* Cabeçalho da Tabela - thead */}
                    <thead className="bg-gray-50/75 select-none border-b border-gray-200">
                      <tr>
                        {[
                          { field: 'unidade', label: 'Unidade' },
                          { field: 'tipo', label: 'Tipo' },
                          { field: 'area', label: 'Área Privativa' },
                          { field: 'status', label: 'Status' },
                          { field: 'valor', label: 'Valor de Venda' }
                        ].map((col) => (
                          <th 
                            key={col.field}
                            onClick={() => toggleSort(col.field)}
                            className="px-6 py-3.5 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:text-black transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{col.label}</span>
                              <span className="text-[9px] text-gray-400">
                                {sortField === col.field ? (
                                  sortAsc ? <FontAwesomeIcon icon={faChevronUp} className="text-black" /> : <FontAwesomeIcon icon={faChevronDown} className="text-black" />
                                ) : (
                                  <FontAwesomeIcon icon={faSort} className="opacity-40" />
                                )}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {/* Corpo da Tabela - tbody */}
                    <tbody className="divide-y divide-gray-150 bg-white">
                      {sortedUnidades.map((item, idx) => (
                        <tr 
                          key={idx}
                          className="hover:bg-gray-50/75 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 text-xs font-black text-gray-900">
                            {item.unidade}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                            {item.tipo}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-gray-850">
                            {item.area}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold">
                            <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                              item.status === 'Disponível'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                : 'bg-red-50 text-red-800 border-red-150'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-gray-900">
                            R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Especificações da Tabela */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col h-full justify-between">
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Regras de Tabelas</h2>
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contêiner Oblíquo</h3>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      Tabelas HTML nativas perdem o border-radius nas quinas. O padrão exige envelopar a tag <code>&lt;table&gt;</code> em uma div com a classe <code>overflow-hidden border border-gray-200 rounded-lg shadow-sm</code>.
                    </p>
                  </div>
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cabeçalhos (TH)</h3>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      O cabeçalho utiliza a classe <code>bg-gray-50/75</code> para contraste em relação às linhas brancas. Textos em <code>text-[10px] font-black uppercase tracking-widest text-gray-500</code>.
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t mt-4">
                  <button 
                    onClick={() => copyToClipboard(
`{/* Contêiner Estilo Padrão Ouro */}
<div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm bg-white">
  <table className="min-w-full divide-y divide-gray-200 table-auto">
    <thead className="bg-gray-50/75 select-none border-b border-gray-200">
      <tr>
        <th className="px-6 py-3.5 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">
          Coluna
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-150 bg-white">
      <tr className="hover:bg-gray-50/75 transition-colors">
        <td className="px-6 py-4 text-xs font-semibold text-gray-700">Dado</td>
      </tr>
    </tbody>
  </table>
</div>`, 'Tabelas')}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faCode} /> Copiar Template HTML
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SEÇÃO 04: KANBAN E CARDS */}
          {/* ========================================================================= */}
          <section id="cards" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">04</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Kanban e Cards</h2>
                <p className="text-xs text-gray-500">Mapeamento estético detalhado de cartões nos fluxos de CRM e Pedidos de Compra.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
              {/* Kanban */}
              <div className="xl:col-span-2 bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
                <h2 className="text-sm font-bold text-gray-900 border-b pb-3">Comparativo de Kanban (CRM vs Compras)</h2>
                <div className="flex flex-col md:flex-row gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100 overflow-x-auto">
                  
                  {/* CRM Column */}
                  <div className="flex-1 min-w-[280px] bg-white border border-gray-200/60 rounded-lg shadow-sm flex flex-col">
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-gray-700">ENTRADA (19)</span>
                        <span className="bg-blue-150 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">SISTEMA</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="text-gray-400 hover:text-black p-0.5 text-xs"><FontAwesomeIcon icon={faChevronDown} /></button>
                        <button className="text-gray-400 hover:text-black p-0.5 text-xs"><FontAwesomeIcon icon={faChevronUp} /></button>
                      </div>
                    </div>
                    
                    <div className="p-2.5 bg-gray-100/50 flex-grow space-y-3">
                      {/* Amostra 1 (Ranniere Teste) */}
                      <div className="relative bg-white p-3.5 rounded-lg border border-gray-250 shadow-sm hover:shadow-md hover:border-black transition-all duration-200 border-l-4 border-l-black space-y-3.5">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-gray-900 text-xs">
                            #1 Ranniere tesrte
                          </h4>
                          <button className="text-gray-400 hover:text-black p-1 text-xs">
                            <FontAwesomeIcon icon={faEllipsisV} />
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {/* Telefone */}
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                            <FontAwesomeIcon icon={faPhone} className="text-gray-400 text-sm rotate-12" />
                            <span>5533555555555</span>
                          </div>

                          {/* Unidades de Interesse */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                              <FontAwesomeIcon icon={faHome} className="text-gray-400 text-sm" />
                              <span>Unidades de Interesse:</span>
                            </div>
                            <div className="pl-6 space-y-1.5">
                              <p className="text-xs text-gray-400 font-bold">Nenhuma unidade associada.</p>
                              <button className="w-full py-1.5 px-3 border border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50 hover:text-black transition-all flex items-center justify-center gap-1.5">
                                <FontAwesomeIcon icon={faPlus} className="text-[10px]" /> Adicionar Unidade
                              </button>
                            </div>
                          </div>

                          {/* Corretor Responsável */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                              <FontAwesomeIcon icon={faUserTie} className="text-gray-400 text-sm" />
                              <span>Corretor Responsável:</span>
                            </div>
                            <div className="pl-6 flex justify-between items-center text-xs">
                              <span className="text-gray-600 font-bold">-- Nenhum --</span>
                              <button className="text-black font-extrabold hover:underline">Adicionar</button>
                            </div>
                          </div>

                          {/* Tag de Canal */}
                          <div className="bg-emerald-50/50 text-emerald-800 border border-emerald-100 rounded-lg py-1.5 px-2.5 text-xs font-semibold flex items-center gap-2">
                            <FontAwesomeIcon icon={faGlobe} className="text-emerald-600" />
                            <span>Landing Page - Elo 57 (Pré-Lançamento)</span>
                          </div>
                        </div>

                        {/* Divisória e Rodapé */}
                        <div className="border-t pt-2.5 flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-bold">Criado em: 23/07/2026 15:55</span>
                          <button className="w-7 h-7 rounded-full bg-green-50 hover:bg-green-500 hover:text-white text-green-600 transition-all flex items-center justify-center shadow-sm">
                            <FontAwesomeIcon icon={faWhatsapp} className="text-sm" />
                          </button>
                        </div>
                      </div>

                      {/* Amostra 2 (Simone da Mata Souza) */}
                      <div className="relative bg-white rounded-lg border border-gray-250 shadow-sm hover:shadow-md hover:border-black transition-all duration-200 border-l-4 border-l-black overflow-hidden">
                        {/* Barra de Tarefas */}
                        <div className="bg-green-50 text-green-800 border-b border-green-200/60 px-3.5 py-2 text-xs font-bold flex justify-between items-center">
                          <span className="flex items-center gap-2"><FontAwesomeIcon icon={faClipboardList} /> 1 TAREFAS (CONCLUÍDAS)</span>
                          <button className="text-green-600 hover:text-green-900"><FontAwesomeIcon icon={faEllipsisV} /></button>
                        </div>

                        <div className="p-3.5 space-y-3.5">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-gray-900 text-xs leading-snug uppercase">
                              # RANNIERE CAMPOS MENDES ARQUITETO LTDA
                            </h4>
                            <button className="text-gray-400 hover:text-black p-1 text-xs">
                              <FontAwesomeIcon icon={faEllipsisV} />
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            {/* Telefone */}
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                              <FontAwesomeIcon icon={faPhone} className="text-gray-400 text-sm rotate-12" />
                              <span>5533991912291</span>
                            </div>

                            {/* Unidades de Interesse */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                                <FontAwesomeIcon icon={faHome} className="text-gray-400 text-sm" />
                                <span>Unidades de Interesse:</span>
                              </div>
                              <div className="pl-6 space-y-1.5">
                                <p className="text-xs text-gray-400 font-bold">Nenhuma unidade associada.</p>
                                <button className="w-full py-1.5 px-3 border border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50 hover:text-black transition-all flex items-center justify-center gap-1.5">
                                  <FontAwesomeIcon icon={faPlus} className="text-[10px]" /> Adicionar Unidade
                                </button>
                              </div>
                            </div>

                            {/* Corretor Responsável */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                                <FontAwesomeIcon icon={faUserTie} className="text-gray-400 text-sm" />
                                <span>Corretor Responsável:</span>
                              </div>
                              <div className="pl-6 flex justify-between items-center text-xs">
                                <span className="text-gray-900 font-extrabold">SIMONE DA MATA SOUZA</span>
                                <button className="text-red-500 font-bold hover:underline flex items-center gap-1"><FontAwesomeIcon icon={faTimes} /> Trocar</button>
                              </div>
                            </div>

                            {/* Tag de Canal */}
                            <div className="bg-emerald-50/50 text-emerald-800 border border-emerald-100 rounded-lg py-1.5 px-2.5 text-xs font-semibold flex items-center gap-2">
                              <FontAwesomeIcon icon={faGlobe} className="text-emerald-600" />
                              <span>Landing Page - Elo 57 (Pré-Lançamento)</span>
                            </div>
                          </div>

                          {/* Divisória e Rodapé */}
                          <div className="border-t pt-2.5 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-bold">Criado em: 01/07/2026 10:36</span>
                            <button className="w-7 h-7 rounded-full bg-green-50 hover:bg-green-500 hover:text-white text-green-600 transition-all flex items-center justify-center shadow-sm">
                              <FontAwesomeIcon icon={faWhatsapp} className="text-sm" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compras Column */}
                  <div className="flex-1 min-w-[280px] bg-white border border-gray-200/60 rounded-lg shadow-sm flex flex-col">
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-gray-700">Em Cotação</span>
                        <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold">3</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="text-gray-400 hover:text-black p-0.5 text-xs"><FontAwesomeIcon icon={faChevronDown} /></button>
                        <button className="text-gray-400 hover:text-black p-0.5 text-xs"><FontAwesomeIcon icon={faChevronUp} /></button>
                      </div>
                    </div>
                    
                    <div className="p-2.5 bg-gray-100/50 flex-grow">
                      <div className="relative bg-[#FFF5F5] p-3.5 rounded-lg border border-red-200/60 shadow-sm hover:shadow-md hover:border-red-400 transition-all duration-200 border-l-4 border-l-red-500 space-y-3.5">
                        
                        {/* Título e Atraso */}
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-gray-900 text-xs leading-snug">
                            #493 - LIMPEZA DE PAVIMENTO
                          </h4>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-bold bg-red-150 text-red-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <FontAwesomeIcon icon={faExclamationTriangle}/> +3 dias
                            </span>
                            <button className="text-gray-400 hover:text-black text-xs" title="Copiar"><FontAwesomeIcon icon={faClone} /></button>
                          </div>
                        </div>
                        
                        {/* Metadados */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                            <FontAwesomeIcon icon={faUser} className="text-gray-400 text-sm w-3.5" />
                            <span>Igor</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                            <FontAwesomeIcon icon={faTag} className="text-gray-400 text-sm w-3.5" />
                            <span>Refúgio Braúnas</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-400 text-sm w-3.5" />
                            <span>Solicitado: 17/04/2026</span>
                          </div>
                        </div>

                        {/* Divisória */}
                        <div className="border-t border-gray-200/40 my-2"></div>

                        {/* Financeiro e Valor */}
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded flex items-center gap-1">
                            <FontAwesomeIcon icon={faFileInvoice} className="text-[10px]" /> Pendente Fin.
                          </span>
                          <span className="text-sm font-black text-emerald-700 flex items-center gap-1">
                            <span>$</span> R$ 0,00
                          </span>
                        </div>

                        {/* Divisória */}
                        <div className="border-t border-gray-200/40 my-2"></div>

                        {/* Rodapé */}
                        <div className="flex justify-between items-center text-xs text-gray-500 font-semibold pt-1">
                          <span>Status: Em Cotação</span>
                          <button className="text-gray-400 hover:text-black"><FontAwesomeIcon icon={faEllipsisV} /></button>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Explicação */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col h-full justify-between">
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Cards & KPIs</h2>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Ambos adotam contorno cinza padrão (<code>border-gray-200</code>) e borda de raio <code>rounded-lg</code> para flat design coerente. Alertas de prioridade utilizam apenas badges minimalistas.
                  </p>
                </div>
                <div className="pt-4 border-t mt-4">
                  <button 
                    onClick={() => copyToClipboard('<div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">', 'Cards')}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faCode} /> Copiar Snippet
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SEÇÃO 05: KPIS E MÉTRICAS */}
          {/* ========================================================================= */}
          <section id="kpis" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">05</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">KPIs e Métricas</h2>
                <p className="text-xs text-gray-500">Métricas financeiras e contadores em design flat limpo.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
              {/* KPIs */}
              <div className="xl:col-span-2 bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
                <h2 className="text-sm font-bold text-gray-900 border-b pb-3">Grid de KPIs Unificados</h2>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between gap-3 hover:border-black transition-all cursor-pointer">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate pr-2">Faturamento Mensal</p>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3.5 w-3.5 text-black" />
                        </div>
                      </div>
                      <p className="text-xl font-black text-gray-900 leading-tight">R$ 45.280,00</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between gap-3 hover:border-black transition-all cursor-pointer">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate pr-2">Pedidos Pendentes</p>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 text-black" />
                        </div>
                      </div>
                      <p className="text-xl font-black text-gray-900 leading-tight">12 Pedidos</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between gap-3 hover:border-black transition-all cursor-pointer">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate pr-2">Contatos Criados</p>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <FontAwesomeIcon icon={faUser} className="h-3.5 w-3.5 text-black" />
                        </div>
                      </div>
                      <p className="text-xl font-black text-gray-900 leading-tight">48 Contatos</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between gap-3 hover:border-black transition-all cursor-pointer">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate pr-2">Conversão</p>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <FontAwesomeIcon icon={faFilter} className="h-3.5 w-3.5 text-black" />
                        </div>
                      </div>
                      <p className="text-xl font-black text-gray-900 leading-tight">18,5%</p>
                    </div>

                  </div>
                </div>
              </div>

              {/* Código */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col h-full justify-between">
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Uso Compartilhado</h2>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Utilize o componente compartilhado <code>KpiCard</code> para desenhar métricas nos painéis do ERP.
                  </p>
                  <pre className="bg-gray-955 text-gray-100 p-4 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed font-semibold">
{`<KpiCard 
  title="Faturamento Mensal" 
  value="R$ 45.280,00" 
  icon={faDollarSign} 
/>`}
                  </pre>
                </div>
                <div className="pt-4 border-t mt-4">
                  <button 
                    onClick={() => copyToClipboard('<KpiCard title="Faturamento" value="R$ 0,00" icon={faDollarSign} />', 'KpiCard')}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faCode} /> Copiar Uso
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SEÇÃO 06: MODAIS E ALERTAS */}
          {/* ========================================================================= */}
          <section id="modais" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">06</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Modais e Alertas</h2>
                <p className="text-xs text-gray-500">Estrutura de janelas de diálogo e pílulas semânticas de status.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Modais */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
                <h2 className="text-sm font-bold text-gray-900 border-b pb-3">Modais e Alertas Padrão Ouro</h2>
                
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pílulas de Status e Alertas</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-green-50 text-green-700 text-[11px] font-bold px-3 py-2 rounded-lg text-center border border-green-200 flex items-center justify-center gap-1">
                      <FontAwesomeIcon icon={faCheckCircle} /> Concluído
                    </div>
                    <div className="bg-amber-50 text-amber-700 text-[11px] font-bold px-3 py-2 rounded-lg text-center border border-amber-200 flex items-center justify-center gap-1">
                      <FontAwesomeIcon icon={faExclamationTriangle} /> Pendente
                    </div>
                    <div className="bg-red-50 text-red-700 text-[11px] font-bold px-3 py-2 rounded-lg text-center border border-red-200 flex items-center justify-center gap-1">
                      <FontAwesomeIcon icon={faTimes} /> Cancelado
                    </div>
                    <div className="bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-2 rounded-lg text-center border border-blue-200 flex items-center justify-center gap-1">
                      <FontAwesomeIcon icon={faInfoCircle} /> Info
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">Mock do Modal Padrão Ouro</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-lg">
                    <div className="bg-black text-white px-5 py-4 flex justify-between items-center">
                      <h3 className="text-xs font-black tracking-wider uppercase">Título do Modal</h3>
                      <button className="text-gray-400 hover:text-white"><FontAwesomeIcon icon={faTimes} /></button>
                    </div>
                    <div className="p-5 bg-white space-y-4">
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Esta é a disposição ideal dos elementos internos e botões em nossos modais administrativos.
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 px-5 py-4 bg-gray-50 border-t">
                      <button className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
                      <button className="px-4 py-2 bg-black hover:bg-gray-905 text-white rounded-lg text-xs font-bold">Salvar</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Código Modais */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Estrutura</h2>
                  <button 
                    onClick={() => copyToClipboard('// Modal structure in system', 'Modal')}
                    className="text-xs text-gray-500 hover:text-black font-semibold flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faCode} /> Copiar
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto flex-1 font-mono leading-relaxed font-semibold">
{`// Modal Header (Sólido Preto):
bg-black text-white px-5 py-4 flex justify-between items-center

// Modal Footer (Cinza com botões):
flex justify-end gap-3 px-5 py-4 bg-gray-50 border-t rounded-b-lg`}
                </pre>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SEÇÃO 07: BIBLIOTECA DE ÍCONES PADRÃO (O "DICIONÁRIO DE ÍCONES") */}
          {/* ========================================================================= */}
          <section id="icones" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">07</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Biblioteca de Ícones Padrão (Dicionário único)</h2>
                <p className="text-xs text-gray-500">Mapeamento e catalogação estrita de ícones do FontAwesome. Cada ação tem um único ícone absoluto.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-8">
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-xs text-amber-900 flex items-start gap-2.5">
                <FontAwesomeIcon icon={faInfoCircle} className="text-sm text-amber-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Regra Geral de Desenvolvimento (Anti-Improvisação Visual):</p>
                  <p className="mt-1">Cada ação comercial ou de dados no ERP Elo 57 deve usar obrigatoriamente o ícone correspondente listado abaixo. É terminantemente proibido utilizar variações como <code>faPen</code>, <code>faPenToSquare</code>, <code>faTrashAlt</code> ou <code>faXmark</code>. Isso mantém a grade visual idêntica de ponta a ponta.</p>
                </div>
              </div>

              <div className="space-y-10">
                {bibliotecaIcones.map((cat, idx) => (
                  <div key={idx} className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-1.5">{cat.categoria}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {cat.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="bg-gray-50 p-4 rounded-lg border border-gray-200/80 flex items-start gap-4 hover:border-gray-400 hover:bg-gray-100/50 transition-all group">
                          <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 text-gray-800 flex items-center justify-center text-lg flex-shrink-0 group-hover:text-black group-hover:border-gray-400 transition-colors shadow-sm">
                            <FontAwesomeIcon icon={item.icon} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-xs font-bold text-gray-900 truncate font-mono">{item.name}</span>
                              <button 
                                onClick={() => copyToClipboard(item.code, item.name)}
                                className="text-[10px] text-gray-400 hover:text-black font-semibold uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <FontAwesomeIcon icon={faCopy} /> Copiar
                              </button>
                            </div>
                            <p className="text-[11px] font-black text-gray-700 uppercase tracking-wider">{item.label}</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-relaxed">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SEÇÃO 08: TIPOGRAFIA E CORES */}
          {/* ========================================================================= */}
          <section id="tipografia" className="scroll-mt-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs">08</div>
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Tipografia e Cores Oficiais</h2>
                <p className="text-xs text-gray-500">Mapeamento de paletas cromáticas da marca (Laranja Elo) e pesos de fontes.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Tipografia */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
                <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Cores e Tipografia da Identidade Visual</h2>
                
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Paleta de Cores do Manual de Identidade</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* Laranja Elo */}
                    <div className="border rounded-lg overflow-hidden shadow-sm hover:border-[#FF6700] transition-colors">
                      <div className="h-16 bg-[#FF6700]"></div>
                      <div className="p-3 text-[11px] bg-white">
                        <p className="font-bold text-gray-900">Laranja Elo</p>
                        <p className="text-gray-500 font-mono mt-0.5">#FF6700</p>
                        <p className="text-[9px] text-[#FF6700] font-black uppercase mt-1">Sotaque Estrito de IA</p>
                      </div>
                    </div>
                    {/* Preto Absoluto */}
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="h-16 bg-[#000000]"></div>
                      <div className="p-3 text-[11px] bg-white">
                        <p className="font-bold text-gray-900">Preto Absoluto</p>
                        <p className="text-gray-500 font-mono mt-0.5">#000000</p>
                        <p className="text-[9px] text-gray-400 font-black uppercase mt-1">Cor Primária</p>
                      </div>
                    </div>
                    {/* Branco */}
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="h-16 border-b bg-[#FFFFFF]"></div>
                      <div className="p-3 text-[11px] bg-white">
                        <p className="font-bold text-gray-900">Branco Puro</p>
                        <p className="text-gray-500 font-mono mt-0.5">#FFFFFF</p>
                        <p className="text-[9px] text-gray-400 font-black uppercase mt-1">Fundo Neutro</p>
                      </div>
                    </div>
                    {/* Cinza */}
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="h-16 bg-[#6B7280]"></div>
                      <div className="p-3 text-[11px] bg-white">
                        <p className="font-bold text-gray-900">Cinza Textos</p>
                        <p className="text-gray-500 font-mono mt-0.5">#6B7280</p>
                        <p className="text-[9px] text-gray-400 font-black uppercase mt-1">Complementar</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tipografias Oficiais</h3>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg border">
                    <div className="border-b pb-2">
                      <span className="text-[9px] text-gray-400 font-bold block mb-1 uppercase font-mono">Voz Primária: Roboto</span>
                      <p className="text-sm text-gray-900 font-semibold" style={{ fontFamily: 'Roboto, sans-serif' }}>
                        Utilizada em slogans, textos corridos, relatórios e e-mails de clientes.
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold block mb-1 uppercase font-mono">Suporte e UI: Montserrat</span>
                      <p className="text-sm text-gray-900 font-bold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        Destaques em botões de ação do CRUD, cabeçalhos, formulários e navegação de listagens.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuração Tailwind */}
              <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Configuração Tailwind</h2>
                  <button 
                    onClick={() => copyToClipboard('// Tailwind config extended', 'Tailwind Config')}
                    className="text-xs text-gray-500 hover:text-black font-semibold flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faCode} /> Copiar
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto flex-1 font-mono leading-relaxed font-semibold">
{`colors: {
  brand: {
    orange: '#FF6700', // Laranja Elo Oficial
  },
  blue: {
    500: '#404040', // Ring Focus
    600: '#000000', // Black Primary
    700: '#1f1f1f', // Hover
  },
  gray: {
    50: '#ffffff',  // Force bg-gray-50 to White
  }
}`}
                </pre>
              </div>
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}
