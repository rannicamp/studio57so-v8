// Caminho: app/(landingpages)/elo57/publicacoes/page.js
'use client';

import { useState, useEffect } from 'react';
import { salvarLeadEventoFiemg } from '../actions';
import { useFormStatus } from 'react-dom';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarDay, faClock, faMapPin, faPaperPlane, faTimes, 
  faDownload, faImage, faChevronRight, faCheck, faInfoCircle, 
  faShareAlt, faNewspaper, faChevronDown, faLock
} from '@fortawesome/free-solid-svg-icons';

// Componente do Botão de Submit com Loading
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      disabled={pending}
      className="w-full bg-[#f25a2f] hover:bg-[#e04f25] text-white font-bold py-4 px-6 rounded-xl disabled:opacity-70 transition-all duration-300 shadow-lg uppercase tracking-wider flex items-center justify-center cursor-pointer text-sm md:text-base border-none outline-none mt-2"
    >
      {pending ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Confirmando Presença...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          Confirmar Presença no Evento <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
        </span>
      )}
    </button>
  );
}

// Modal do Formulário de Cadastro do Evento
function FormularioEvento({ onClose, onSuccess }) {
  const [tipoPessoa, setTipoPessoa] = useState('PF');
  const [country, setCountry] = useState('BR');
  const [profissao, setProfissao] = useState('');
  const [segmento, setSegmento] = useState('');
  const [done, setDone] = useState(false);

  const maskPhone = country === 'BR' ? '(00) 0000[0]-0000' : '(000) 000-0000';
  const countryCodeValue = country === 'BR' ? '+55' : '+1';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    if (tipoPessoa === 'PF') {
      formData.set('personalidade_juridica', 'Pessoa Física');
      const finalCargo = profissao === 'Outros' ? formData.get('outra_profissao') : profissao;
      formData.set('cargo', finalCargo);
      formData.delete('cnpj');
      formData.delete('razao_social');
      formData.delete('pessoa_contato');
    } else {
      formData.set('personalidade_juridica', 'Pessoa Jurídica');
      const nomeEmpresa = formData.get('razao_social');
      formData.set('nome', nomeEmpresa);
      const finalCargo = segmento === 'Outros' ? formData.get('outro_segmento') : segmento;
      formData.set('cargo', finalCargo);
      formData.delete('cpf');
    }

    try {
      await salvarLeadEventoFiemg(formData);
      setDone(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2500);
    } catch(err) {
      console.error(err);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-t-4 border-[#f25a2f] animate-fadeIn">
          <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            ✓
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Presença Confirmada!</h3>
          <p className="text-sm text-slate-500 font-light leading-relaxed">
            Seu cadastro foi recebido com sucesso no funil de entrada. Nos vemos no dia 19 no auditório da FIEMG!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="relative bg-white text-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-xl w-full m-auto animate-fadeIn border-t-4 border-[#f25a2f] max-h-[90vh] overflow-y-auto scrollbar-thin">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#f25a2f] transition-colors bg-gray-100 hover:bg-orange-50 rounded-full p-2 w-8 h-8 flex items-center justify-center cursor-pointer border-none outline-none z-50"
          aria-label="Fechar"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="text-center mb-6">
          <span className="bg-orange-50 text-[#f25a2f] text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-2 inline-block">
            Credenciamento Gratuito
          </span>
          <h2 className="text-2xl md:text-3xl font-bold mb-1 text-slate-900 tracking-tight">
            Garantir Minha Vaga
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-light leading-relaxed">
            Preencha seus dados para receber o convite digital e garantir seu assento no Auditório da FIEMG.
          </p>
        </div>

        <div className="flex border border-slate-100 rounded-xl p-1 mb-6 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setTipoPessoa('PF')}
            className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all border-none outline-none cursor-pointer ${
              tipoPessoa === 'PF' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 bg-transparent'
            }`}
          >
            Pessoa Física
          </button>
          <button
            type="button"
            onClick={() => setTipoPessoa('PJ')}
            className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all border-none outline-none cursor-pointer ${
              tipoPessoa === 'PJ' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 bg-transparent'
            }`}
          >
            Pessoa Jurídica
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="origem" value="Evento FIEMG - Elo 57" />
          <input type="hidden" name="country_code" value={countryCodeValue} />
          <input type="hidden" name="personalidade_juridica" value={tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'} />

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="telefone" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">WhatsApp</label>
              <div className="flex items-center">
                <div className="relative">
                  <select 
                    onChange={(e) => setCountry(e.target.value)} 
                    value={country}
                    className="appearance-none bg-slate-50 border border-slate-200 border-r-0 rounded-l-xl py-3 pl-3 pr-7 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] cursor-pointer h-[48px] text-sm"
                  >
                    <option value="BR">🇧🇷 +55</option>
                    <option value="US">🇺🇸 +1</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
                <IMaskInput
                  mask={maskPhone}
                  id="telefone"
                  name="telefone"
                  required
                  placeholder={country === 'BR' ? '(99) 99999-9999' : '(555) 555-5555'}
                  className="w-full bg-slate-50 border border-slate-200 border-l-0 text-slate-900 rounded-r-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">E-mail</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                required 
                placeholder="exemplo@empresa.com"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
              />
            </div>
          </div>

          {tipoPessoa === 'PF' ? (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label htmlFor="nome" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  id="nome" 
                  name="nome" 
                  required 
                  placeholder="Seu nome completo"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cpf" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">CPF</label>
                  <IMaskInput
                    mask="000.000.000-00"
                    id="cpf"
                    name="cpf"
                    required
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="profissao" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Profissão</label>
                  <select 
                    id="profissao" 
                    value={profissao} 
                    onChange={(e) => setProfissao(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="Incorporadora Imobiliária">Incorporadora Imobiliária</option>
                    <option value="Engenheiro Civil">Engenheiro Civil</option>
                    <option value="Arquiteto">Arquiteto</option>
                    <option value="Profissional Liberal">Profissional Liberal</option>
                    <option value="Corretor de Imóveis">Corretor de Imóveis</option>
                    <option value="Investidor Imobiliário">Investidor Imobiliário</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              {profissao === 'Outros' && (
                <div className="animate-slideDown">
                  <label htmlFor="outra_profissao" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Especifique sua profissão</label>
                  <input 
                    type="text" 
                    id="outra_profissao" 
                    name="outra_profissao" 
                    required 
                    placeholder="Digite sua profissão"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label htmlFor="razao_social" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Razão Social / Nome da Empresa</label>
                <input 
                  type="text" 
                  id="razao_social" 
                  name="razao_social" 
                  required 
                  placeholder="Nome fantasia ou razão social da empresa"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cnpj" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">CNPJ</label>
                  <IMaskInput
                    mask="00.000.000/0000-00"
                    id="cnpj"
                    name="cnpj"
                    required
                    placeholder="00.000.000/0000-00"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="segmento" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Segmento de Atuação</label>
                  <select 
                    id="segmento" 
                    value={segmento} 
                    onChange={(e) => setSegmento(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="Construtora">Construtora</option>
                    <option value="Incorporadora">Incorporadora</option>
                    <option value="Investidor Imobiliário">Investidor Imobiliário</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              {segmento === 'Outros' && (
                <div className="animate-slideDown">
                  <label htmlFor="outro_segmento" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Especifique o segmento</label>
                  <input 
                    type="text" 
                    id="outro_segmento" 
                    name="outro_segmento" 
                    required 
                    placeholder="Ex: Insumos, Metalúrgica"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                  />
                </div>
              )}

              <div>
                <label htmlFor="pessoa_contato" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Nome do Responsável / Contato</label>
                <input 
                  type="text" 
                  id="pessoa_contato" 
                  name="pessoa_contato" 
                  required 
                  placeholder="Seu nome completo"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                />
              </div>
            </div>
          )}

          <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faLock} className="text-[#f25a2f] text-[9px]" />
            Em conformidade com a LGPD.
          </p>

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

// Modal do Visualizador de Convite (Imagem Quadrada)
function VisualizadorConvite({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[9999] p-4">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 text-white hover:text-[#f25a2f] text-2xl transition-colors cursor-pointer border-none bg-black/40 hover:bg-black/70 p-2.5 rounded-full w-12 h-12 flex items-center justify-center"
        aria-label="Fechar"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>

      <div className="max-w-lg w-full bg-slate-900 p-2 rounded-2xl shadow-2xl border border-slate-800">
        <img 
          src="/elo57_convite_fiemg.jpg" 
          alt="Convite Oficial Elo 57 FIEMG" 
          className="w-full h-auto rounded-xl object-contain shadow-lg"
        />
        <div className="flex justify-between items-center p-4">
          <div className="text-left">
            <h4 className="text-sm font-bold text-white">Convite Oficial Elo 57</h4>
            <p className="text-xs text-slate-400">1080x1080px · Evento FIEMG</p>
          </div>
          <a 
            href="/elo57_convite_fiemg.jpg" 
            download="Convite_Elo57_FIEMG.jpg"
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <FontAwesomeIcon icon={faDownload} /> Baixar
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PublicacoesElo() {
  const [mounted, setMounted] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImgOpen, setIsImgOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('todos');
  const [selectedPub, setSelectedPub] = useState(null);
  
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    setMounted(true);

    const targetDate = new Date('2026-08-19T19:00:00');
    
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();
      
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lista de Publicações/Postagens
  const PUBS = [
    {
      id: 1,
      tag: 'evento',
      date: 'Hoje',
      title: 'Grande Lançamento Oficial do Elo 57 no Leste de Minas',
      summary: 'Participe do evento exclusivo de apresentação da nossa plataforma no dia 19 de Agosto, no prestigiado auditório da FIEMG Regional Rio Doce, em Governador Valadares.',
      detail: 'O evento contará com a presença de construtores, incorporadores e engenheiros de toda a região para conhecer as inovações tecnológicas do Elo 57, o sistema ERP 5D que unifica holdings, SPEs, canteiros de obras e inteligência artificial via WhatsApp.\n\nData: 19 de Agosto (Quarta-feira)\nHorário: 19:00h\nLocal: Auditório da FIEMG (Governador Valadares, MG)\nInscrições gratuitas limitadas.',
      image: '/elo57_convite_fiemg.jpg',
      featured: true
    },
    {
      id: 2,
      tag: 'tecnologia',
      date: '24 Jul 2026',
      title: 'Stella SDR 2.0: A Inteligência Artificial integrada ao seu CRM do Elo 57',
      summary: 'Descubra como a nossa inteligência artificial revoluciona a qualificação consultiva de leads diretamente no WhatsApp, executando o transbordo para o funil comercial de forma automática.',
      detail: 'A Stella SDR 2.0 conversa com potenciais compradores de imóveis, analisa as necessidades, verifica o perfil consultivo utilizando critérios estratégicos de vendas, e direciona o card para a equipe comercial exatamente na coluna correta do Kanban, sem a necessidade de intervenção humana nas etapas iniciais.',
      image: null,
      featured: false
    },
    {
      id: 3,
      tag: 'engenharia',
      date: '22 Jul 2026',
      title: 'Como o Orçamento BIM 5D na Web elimina surpresas e estouros no orçamento',
      summary: 'Integrar projetos tridimensionais (BIM) diretamente com composições de custos e quantitativos no navegador é o segredo das construtoras de alto desempenho.',
      detail: 'O módulo BIM 5D do Elo 57 extrai quantitativos automaticamente e vincula ao banco de insumos do ERP, atualizando o orçamento de obras em tempo real sempre que há modificações no modelo, gerando relatórios de curva ABC, cronograma físico-financeiro e projeções de fluxo de caixa com precisão cirúrgica.',
      image: null,
      featured: false
    },
    {
      id: 4,
      tag: 'gestao',
      date: '18 Jul 2026',
      title: 'Holdings, SPEs e Construtoras: Centralize tudo em um único painel SaaS',
      summary: 'A gestão financeira de múltiplos empreendimentos exige controle absoluto de caixa e rateios. Conheça as vantagens da estrutura multitenant corporativa do Elo 57.',
      detail: 'Chega de planilhas separadas e conciliações fiscais complexas. O sistema de multi-empresas do Elo 57 gerencia e consolida dados de holdings e sociedades de propósito específico (SPE) em tempo real, permitindo análises de lucratividade unificadas ou por CNPJ em cliques rápidos.',
      image: null,
      featured: false
    }
  ];

  const filteredPubs = activeTab === 'todos' ? PUBS : PUBS.filter(p => p.tag === activeTab);

  return (
    <div className="relative bg-slate-950 font-sans min-h-screen text-slate-100 scroll-smooth">
      
      {/* Background Gradients */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-orange-500/10 via-slate-950/0 to-slate-950 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <a href="/elo57" className="w-[120px] md:w-[150px] transition-transform hover:scale-[1.02] inline-block">
            <img 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/8/IMG_1770136280158.png" 
              alt="Elo 57 Logo" 
              className="w-full h-auto object-contain brightness-0 invert" 
            />
          </a>
          <span className="hidden sm:inline-block px-2 py-0.5 border border-orange-500/30 text-orange-400 text-[9px] uppercase tracking-widest font-bold rounded">
            Publicações
          </span>
        </div>
        <nav className="flex gap-4">
          <a 
            href="/elo57" 
            className="text-xs md:text-sm font-semibold text-slate-300 hover:text-white transition-colors py-2 px-3 hover:bg-slate-900/50 rounded-lg"
          >
            Voltar para o Site
          </a>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-[#f25a2f] hover:bg-[#e04f25] text-white text-xs md:text-sm font-bold rounded-lg transition-all shadow-md cursor-pointer border-none outline-none"
          >
            Garantir Vaga
          </button>
        </nav>
      </header>

      {/* Seção Hero: O Convite da FIEMG */}
      <section className="relative overflow-hidden pt-12 pb-16 md:py-24 border-b border-slate-900">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Informações do Convite */}
          <div className={`lg:col-span-7 space-y-6 text-left z-10 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] md:text-xs font-bold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
              Lançamento Oficial no Leste de Minas
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              O futuro do <br className="hidden md:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#f25a2f]">
                ERP 5D na Web
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-400 font-light leading-relaxed max-w-xl">
              Você é nosso convidado de honra. Venha conhecer a primeira plataforma unificada de engenharia e incorporação SaaS do país, agora integrando múltiplos empreendimentos, controle BIM e atendimento automatizado via IA.
            </p>

            {/* Ficha Técnica do Evento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 max-w-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-slate-800 rounded-xl text-[#f25a2f] text-sm">
                  <FontAwesomeIcon icon={faCalendarDay} />
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Data</h4>
                  <p className="text-xs md:text-sm font-bold text-white mt-0.5">19 de Agosto</p>
                  <p className="text-[10px] text-slate-400">Quarta-feira</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-slate-800 rounded-xl text-[#f25a2f] text-sm">
                  <FontAwesomeIcon icon={faClock} />
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Horário</h4>
                  <p className="text-xs md:text-sm font-bold text-white mt-0.5">19:00 horas</p>
                  <p className="text-[10px] text-slate-400">Horário de Brasília</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-slate-800 rounded-xl text-[#f25a2f] text-sm">
                  <FontAwesomeIcon icon={faMapPin} />
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Local</h4>
                  <p className="text-xs md:text-sm font-bold text-white mt-0.5">Auditório FIEMG</p>
                  <p className="text-[10px] text-slate-400">Gov. Valadares, MG</p>
                </div>
              </div>
            </div>

            {/* Contador de Tempo Regressivo */}
            <div className="flex items-center gap-6">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tempo Restante:</div>
              <div className="flex gap-3 text-center bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-xl">
                <div>
                  <span className="text-sm md:text-base font-bold text-white">{timeLeft.days}</span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block">Dias</span>
                </div>
                <div className="text-xs text-slate-600">:</div>
                <div>
                  <span className="text-sm md:text-base font-bold text-white">{timeLeft.hours.toString().padStart(2, '0')}</span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block">Hrs</span>
                </div>
                <div className="text-xs text-slate-600">:</div>
                <div>
                  <span className="text-sm md:text-base font-bold text-white">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block">Min</span>
                </div>
                <div className="text-xs text-slate-600">:</div>
                <div>
                  <span className="text-sm md:text-base font-bold text-white">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider block">Seg</span>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-4 pt-2">
              <button 
                onClick={() => setIsFormOpen(true)}
                className="px-6 py-4 bg-[#f25a2f] hover:bg-[#e04f25] text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-sm md:text-base border-none outline-none"
              >
                Garantir Minha Presença
              </button>
              <button 
                onClick={() => setIsImgOpen(true)}
                className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 font-bold rounded-xl shadow-sm hover:shadow transition-all duration-300 cursor-pointer text-sm md:text-base flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faImage} /> Ver Convite Oficial
              </button>
            </div>

          </div>

          {/* Card Visual / Convite do Lançamento */}
          <div className={`lg:col-span-5 flex justify-center z-10 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div 
              onClick={() => setIsImgOpen(true)}
              className="relative group max-w-[360px] w-full bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-3 shadow-2xl transition-all duration-500 cursor-pointer transform hover:scale-[1.02] hover:-rotate-1"
            >
              <div className="absolute top-6 right-6 bg-[#f25a2f] text-white text-[9px] font-black uppercase tracking-widest py-1 px-3.5 rounded-full shadow-md z-20">
                Convite Oficial
              </div>
              <div className="relative overflow-hidden rounded-2xl aspect-square">
                <img 
                  src="/elo57_convite_fiemg.jpg" 
                  alt="Convite Oficial FIEMG" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white z-10">
                  <div className="text-left">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Clique para ver</p>
                    <h3 className="text-sm font-bold mt-0.5">Auditório FIEMG</h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xs">
                    🔍
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Feed / Stream de Publicações */}
      <section id="feed" className="py-16 max-w-5xl mx-auto px-6">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2.5">
            <FontAwesomeIcon icon={faNewspaper} className="text-[#f25a2f] text-xl" />
            Publicações Elo 57
          </h2>
          <p className="text-sm text-slate-400 font-light max-w-lg mx-auto">
            Acompanhe comunicados, atualizações de tecnologia e artigos técnicos do ecossistema Elo 57.
          </p>
        </div>

        {/* Abas de Categoria */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {['todos', 'evento', 'tecnologia', 'engenharia', 'gestao'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-full transition-all border outline-none cursor-pointer uppercase tracking-wider ${
                activeTab === tab 
                  ? 'bg-white text-slate-900 border-white shadow' 
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab === 'todos' ? 'Todos' : tab}
            </button>
          ))}
        </div>

        {/* Lista de Publicações */}
        <div className="space-y-6">
          {filteredPubs.map((pub) => (
            <article 
              key={pub.id}
              onClick={() => setSelectedPub(pub)}
              className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col md:flex-row gap-6 text-left group ${
                pub.featured 
                  ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700/80 shadow-lg relative overflow-hidden ring-1 ring-orange-500/10'
                  : 'bg-slate-900/20 border-slate-900 hover:border-slate-800/80 hover:bg-slate-900/30'
              }`}
            >
              {pub.featured && (
                <div className="absolute top-0 left-0 w-2 h-full bg-[#f25a2f]" />
              )}

              {/* Se tiver imagem, mostra miniatura lateral */}
              {pub.image && (
                <div className="w-full md:w-44 h-44 rounded-xl overflow-hidden shrink-0 border border-slate-800 bg-slate-950 flex items-center justify-center">
                  <img 
                    src={pub.image} 
                    alt={pub.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}

              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[#f25a2f] font-bold uppercase tracking-wider">{pub.tag}</span>
                    <span className="text-slate-600 font-bold">•</span>
                    <span className="text-slate-500">{pub.date}</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white group-hover:text-orange-400 transition-colors leading-tight">
                    {pub.title}
                  </h3>
                  <p className="text-xs md:text-sm text-slate-400 font-light leading-relaxed">
                    {pub.summary}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-[#f25a2f] group-hover:gap-2.5 transition-all">
                  Ler Mais <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6 text-center text-xs text-slate-500 space-y-3 relative z-10">
        <div className="max-w-[100px] mx-auto brightness-0 invert opacity-45">
          <img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/8/IMG_1770136280158.png" alt="Elo 57 Logo" />
        </div>
        <p>© 2026 Elo 57. Plataforma ERP 5D SaaS de Engenharia Civil. Todos os direitos reservados.</p>
        <p className="font-light">Desenvolvido com carinho para o Studio 57.</p>
      </footer>

      {/* Modais Ativos */}
      {isFormOpen && (
        <FormularioEvento 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {}}
        />
      )}

      {isImgOpen && (
        <VisualizadorConvite 
          onClose={() => setIsImgOpen(false)} 
        />
      )}

      {/* Modal de Leitura de Detalhe da Publicação */}
      {selectedPub && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="relative bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 md:p-8 max-w-2xl w-full m-auto animate-fadeIn max-h-[85vh] overflow-y-auto scrollbar-thin space-y-6">
            
            <button 
              onClick={() => setSelectedPub(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 rounded-full p-2.5 w-10 h-10 flex items-center justify-center cursor-pointer border-none outline-none z-50"
              aria-label="Fechar"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#f25a2f] font-bold uppercase tracking-wider">{selectedPub.tag}</span>
                <span className="text-slate-600 font-bold">•</span>
                <span className="text-slate-500">{selectedPub.date}</span>
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
                {selectedPub.title}
              </h2>
            </div>

            {selectedPub.image && (
              <div className="w-full rounded-2xl overflow-hidden border border-slate-800 max-h-[300px] flex items-center justify-center bg-slate-950 cursor-pointer" onClick={() => { if (selectedPub.id === 1) setIsImgOpen(true); }}>
                <img 
                  src={selectedPub.image} 
                  alt={selectedPub.title} 
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            <div className="text-sm md:text-base text-slate-300 font-light leading-relaxed whitespace-pre-line text-left">
              {selectedPub.detail}
            </div>

            {selectedPub.id === 1 && (
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                <button 
                  onClick={() => { setSelectedPub(null); setIsFormOpen(true); }}
                  className="px-5 py-3 bg-[#f25a2f] hover:bg-[#e04f25] text-white font-bold rounded-xl text-xs md:text-sm transition-all cursor-pointer border-none"
                >
                  Garantir Minha Vaga
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
