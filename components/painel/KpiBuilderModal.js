"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, faSave, faCheck, faChartPie, faArrowUp, faArrowDown, 
  faWallet, faMoneyBillWave, faPiggyBank, faCoins, faSpinner, faPen, 
  faCalculator, faDatabase, faPercentage, faLayerGroup, 
  faChartLine, faChartBar, faSquare, faCalendarAlt, faAlignLeft
} from '@fortawesome/free-solid-svg-icons';
import FiltroFinanceiro from '@/components/financeiro/FiltroFinanceiro';
import { toast } from 'sonner';

const OPCOES_ICONES = [
  { id: 'faArrowUp', icon: faArrowUp, label: 'Seta Cima' },
  { id: 'faArrowDown', icon: faArrowDown, label: 'Seta Baixo' },
  { id: 'faWallet', icon: faWallet, label: 'Carteira' },
  { id: 'faMoneyBillWave', icon: faMoneyBillWave, label: 'Dinheiro' },
  { id: 'faPiggyBank', icon: faPiggyBank, label: 'Porquinho' },
  { id: 'faCoins', icon: faCoins, label: 'Moedas' },
  { id: 'faChartPie', icon: faChartPie, label: 'Gráfico' },
  { id: 'faCalculator', icon: faCalculator, label: 'Calculadora' },
  { id: 'faPercentage', icon: faPercentage, label: 'Percentual' },
];

const OPCOES_CORES = [
  { id: '#10B981', label: 'Verde (Receita)', class: 'bg-emerald-500' },
  { id: '#EF4444', label: 'Vermelho (Despesa)', class: 'bg-red-500' },
  { id: '#3B82F6', label: 'Azul (Neutro)', class: 'bg-blue-500' },
  { id: '#F59E0B', label: 'Laranja (Alerta)', class: 'bg-amber-500' },
  { id: '#8B5CF6', label: 'Roxo (Estratégico)', class: 'bg-violet-500' },
];

export default function KpiBuilderModal({ isOpen, onClose, onSaveSuccess, kpiToEdit = null }) {
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // --- ESTADOS ---
  const [abaAtiva, setAbaAtiva] = useState('filtro');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState(''); // Novo estado para descrição
  const [grupo, setGrupo] = useState('');
  
  // Visual
  const [iconeSelecionado, setIconeSelecionado] = useState('faWallet');
  const [corSelecionada, setCorSelecionada] = useState('#3B82F6');
  
  // Configuração do Gráfico
  const [tipoVisualizacao, setTipoVisualizacao] = useState('card');
  const [agrupamentoTempo, setAgrupamentoTempo] = useState('mes');

  const [salvando, setSalvando] = useState(false);

  // Estados dos Filtros/Fórmulas
  const [filtrosConfigurados, setFiltrosConfigurados] = useState({});
  const [formulaVisual, setFormulaVisual] = useState(''); 
  const [formatoSaida, setFormatoSaida] = useState('moeda');

  // --- BUSCA KPIs E GRUPOS ---
  const { data: dadosIniciais = { kpis: [], grupos: [] }, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['kpis_e_grupos', user?.organizacao_id],
    queryFn: async () => {
      if (!user?.organizacao_id) return { kpis: [], grupos: [] };
      
      const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('id, titulo, grupo')
        .eq('organizacao_id', user.organizacao_id);
      
      if (error) throw error;

      const gruposUnicos = [...new Set(data.map(item => item.grupo).filter(Boolean))];
      
      return { kpis: data, grupos: gruposUnicos };
    },
    enabled: isOpen && !!user?.organizacao_id,
    staleTime: 0 
  });

  const todosKpis = dadosIniciais.kpis;
  const gruposDisponiveis = dadosIniciais.grupos;

  const kpisDisponiveis = useMemo(() => 
    todosKpis.filter(k => k.id !== kpiToEdit?.id), 
  [todosKpis, kpiToEdit]);

  // --- TRADUTORES DE FÓRMULA ---
  const internalToDisplay = (formulaInterna) => {
    if (!formulaInterna) return '';
    let display = formulaInterna;
    const regex = /@\{\s*([a-zA-Z0-9\-]+)\s*\}/g;
    display = display.replace(regex, (match, id) => {
        const kpi = todosKpis.find(k => k.id.toString() === id.toString());
        return kpi ? `[${kpi.titulo}]` : match; 
    });
    return display;
  };

  const displayToInternal = (formulaDisplay) => {
    if (!formulaDisplay) return '';
    let internal = formulaDisplay;
    const sortedKpis = [...todosKpis].sort((a, b) => b.titulo.length - a.titulo.length);
    sortedKpis.forEach(kpi => {
        const escapedName = kpi.titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\[${escapedName}\\]`, 'g');
        internal = internal.replace(regex, `@{${kpi.id}}`);
    });
    return internal;
  };

  // --- CARREGAR DADOS NA EDIÇÃO ---
  useEffect(() => {
    if (isOpen && !isLoadingKpis) {
        if (kpiToEdit) {
            setTitulo(kpiToEdit.titulo);
            setDescricao(kpiToEdit.descricao || ''); // Carrega a descrição
            setGrupo(kpiToEdit.grupo || '');
            
            setTipoVisualizacao(kpiToEdit.tipo_visualizacao || 'card');
            setAgrupamentoTempo(kpiToEdit.agrupamento_tempo || 'mes');

            const metaVisual = kpiToEdit.filtros?._meta_visual || {};
            setIconeSelecionado(metaVisual.icone || kpiToEdit.icone || 'faWallet');
            setCorSelecionada(metaVisual.cor || '#3B82F6');

            const tipo = kpiToEdit.filtros?._config_tipo || 'filtro';
            setAbaAtiva(tipo);

            if (tipo === 'formula') {
                const expressaoInterna = kpiToEdit.filtros?.formula_expressao || '';
                setFormulaVisual(internalToDisplay(expressaoInterna));
                setFormatoSaida(kpiToEdit.filtros?.formula_formato || 'moeda');
            } else {
                setFiltrosConfigurados(kpiToEdit.filtros || {});
            }
        } else {
            // Reset
            setTitulo('');
            setDescricao('');
            setGrupo('');
            setTipoVisualizacao('card');
            setAgrupamentoTempo('mes');
            setIconeSelecionado('faWallet');
            setCorSelecionada('#3B82F6');
            setAbaAtiva('filtro');
            setFiltrosConfigurados({});
            setFormulaVisual('');
            setFormatoSaida('moeda');
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, kpiToEdit, isLoadingKpis]);

  const inserirVariavel = (kpiNome) => {
    const tag = ` [${kpiNome}] `; 
    setFormulaVisual(prev => prev + tag);
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast.warning("Dê um nome para o seu indicador!");
      return;
    }

    const grupoFinal = grupo.trim() || 'Geral';

    if (abaAtiva === 'formula' && !formulaVisual.trim()) {
        toast.warning("A fórmula não pode estar vazia.");
        return;
    }

    setSalvando(true);
    try {
      let configFinal = {};

      if (abaAtiva === 'formula') {
        const formulaInterna = displayToInternal(formulaVisual);
        configFinal = {
            _config_tipo: 'formula',
            _meta_visual: { cor: corSelecionada, icone: iconeSelecionado },
            formula_expressao: formulaInterna,
            formula_formato: formatoSaida
        };
      } else {
        configFinal = {
            ...filtrosConfigurados,
            _config_tipo: 'filtro',
            _meta_visual: { cor: corSelecionada, icone: iconeSelecionado }
        };
      }

      const payload = {
          titulo: titulo,
          descricao: descricao.trim().substring(0, 60), // Salva a descrição (limite segurança)
          grupo: grupoFinal,
          tipo_visualizacao: tipoVisualizacao,
          agrupamento_tempo: agrupamentoTempo,
          filtros: configFinal,
          modulo: 'financeiro',
          tipo_calculo: 'soma_dinamica'
      };

      let error;

      if (kpiToEdit) {
        // UPDATE
        const response = await supabase
            .from('kpis_personalizados')
            .update(payload)
            .eq('id', kpiToEdit.id)
            .select(); 
            
        error = response.error;
        if (!error && (!response.data || response.data.length === 0)) {
             throw new Error("Não foi possível salvar. Verifique suas permissões.");
        }
        if (!error) toast.success("Indicador atualizado!");

      } else {
        // INSERT
        const insertPayload = {
            ...payload,
            usuario_id: user.id,
            organizacao_id: user.organizacao_id,
            exibir_no_painel: true,
            tipo_kpi: 'financeiro',
            created_at: new Date()
        };

        const response = await supabase
            .from('kpis_personalizados')
            .insert(insertPayload)
            .select();
            
        error = response.error;
        if (!error) toast.success("Indicador criado!");
      }

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['meus_kpis'] });
      await queryClient.invalidateQueries({ queryKey: ['kpis_e_grupos'] });
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().includes('kpi') 
      });

      if (onSaveSuccess) onSaveSuccess(); 
      onClose();
      
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message || "Tente novamente"}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-visible">
        
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
                {kpiToEdit ? 'Editar Indicador' : 'Novo Indicador Financeiro'}
            </h2>
            <p className="text-sm text-gray-500">Defina regras de filtro ou visualizações gráficas.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2">
            <FontAwesomeIcon icon={faTimes} className="text-xl" />
          </button>
        </div>

        {isLoadingKpis ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                <p>Carregando dados...</p>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                
                {/* 1. Identidade Visual & Formato */}
                <section className="space-y-6">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-l-4 border-blue-500 pl-2">
                    1. Identidade & Formato
                    </h3>
                    
                    {/* Título e Grupo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Título do Indicador</label>
                            <input 
                                type="text" 
                                value={titulo} 
                                onChange={(e) => setTitulo(e.target.value)} 
                                placeholder="Ex: Faturamento Mensal..." 
                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                                autoFocus={!kpiToEdit} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <FontAwesomeIcon icon={faLayerGroup} className="mr-1 text-gray-400"/> 
                                Grupo
                            </label>
                            <input 
                                list="grupos-sugestoes"
                                type="text" 
                                value={grupo} 
                                onChange={(e) => setGrupo(e.target.value)} 
                                placeholder="Ex: Vendas" 
                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors" 
                            />
                            <datalist id="grupos-sugestoes">
                                {gruposDisponiveis.map((g, idx) => <option key={idx} value={g} />)}
                            </datalist>
                        </div>
                    </div>

                    {/* Descrição Curta */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FontAwesomeIcon icon={faAlignLeft} className="mr-1 text-gray-400"/> 
                            Descrição Curta <span className="text-xs text-gray-400 font-normal">({descricao.length}/60 car.)</span>
                        </label>
                        <input 
                            type="text" 
                            value={descricao} 
                            onChange={(e) => setDescricao(e.target.value)} 
                            maxLength={60}
                            placeholder="Ex: Total de vendas recebidas este mês. Aparece no rodapé do card." 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                    </div>

                    {/* SELEÇÃO DE FORMATO: CARD vs GRÁFICO */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Como você quer visualizar?</label>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setTipoVisualizacao('card')}
                                className={`flex-1 p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${tipoVisualizacao === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-blue-300 bg-white'}`}
                            >
                                <FontAwesomeIcon icon={faSquare} className="text-2xl" />
                                <span className="font-medium text-sm">Cartão Numérico</span>
                            </button>
                            <button 
                                onClick={() => setTipoVisualizacao('grafico_linha')}
                                className={`flex-1 p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${tipoVisualizacao.startsWith('grafico') ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300 bg-white'}`}
                            >
                                <FontAwesomeIcon icon={faChartLine} className="text-2xl" />
                                <span className="font-medium text-sm">Gráfico de Evolução</span>
                            </button>
                        </div>

                        {/* CONFIGURAÇÕES ESPECÍFICAS DE GRÁFICO */}
                        {tipoVisualizacao.startsWith('grafico') && (
                            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tipo de Gráfico</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setTipoVisualizacao('grafico_linha')} className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${tipoVisualizacao === 'grafico_linha' ? 'bg-purple-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                            <FontAwesomeIcon icon={faChartLine} /> Linha
                                        </button>
                                        <button onClick={() => setTipoVisualizacao('grafico_barra')} className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${tipoVisualizacao === 'grafico_barra' ? 'bg-purple-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                            <FontAwesomeIcon icon={faChartBar} /> Barras
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Agrupar Por</label>
                                    <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden">
                                        {['dia', 'mes', 'ano'].map((tempo) => (
                                            <button 
                                                key={tempo}
                                                onClick={() => setAgrupamentoTempo(tempo)}
                                                className={`flex-1 py-2 text-xs font-medium uppercase transition-colors ${agrupamentoTempo === tempo ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-50'}`}
                                            >
                                                {tempo}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CONFIGURAÇÕES VISUAIS (Apenas se for Card ou para definir cor geral) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {tipoVisualizacao === 'card' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                    {OPCOES_ICONES.map((opt) => (
                                        <button key={opt.id} onClick={() => setIconeSelecionado(opt.id)} className={`flex flex-col items-center justify-center p-3 rounded-xl min-w-[60px] border transition-all ${iconeSelecionado === opt.id ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                                            <FontAwesomeIcon icon={opt.icon} className="text-lg mb-1" />
                                            <span className="text-[9px] font-medium truncate w-full text-center">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Cor Principal</label>
                            <div className="flex gap-3">
                                {OPCOES_CORES.map((cor) => (
                                    <button key={cor.id} onClick={() => setCorSelecionada(cor.id)} className={`w-8 h-8 rounded-full flex items-center justify-center ${cor.class} ${corSelecionada === cor.id ? 'ring-4 ring-offset-2 ring-gray-200 scale-110 shadow-md' : 'opacity-70 hover:opacity-100'}`}>
                                        {corSelecionada === cor.id && <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Origem dos Dados */}
                <section className="space-y-4 relative z-10">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-l-4 border-purple-500 pl-2">
                    2. Origem dos Dados
                    </h3>

                    <div className="flex border-b border-gray-200 mb-4">
                        <button onClick={() => setAbaAtiva('filtro')} className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${abaAtiva === 'filtro' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <FontAwesomeIcon icon={faDatabase} className="mr-2" /> Base de Dados
                        </button>
                        <button onClick={() => setAbaAtiva('formula')} className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${abaAtiva === 'formula' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <FontAwesomeIcon icon={faCalculator} className="mr-2" /> Fórmula Calculada
                        </button>
                    </div>
                    
                    {abaAtiva === 'filtro' && (
                        <div className="border border-gray-200 rounded-xl relative animate-fade-in">
                            <FiltroFinanceiro onFilterChange={setFiltrosConfigurados} filtrosAtuais={filtrosConfigurados} compacto={true} />
                        </div>
                    )}

                    {abaAtiva === 'formula' && (
                        <div className="border border-gray-200 rounded-xl p-6 bg-white animate-fade-in space-y-6">
                            <p className="text-sm text-gray-500 bg-purple-50 p-3 rounded-lg border border-purple-100">
                                <FontAwesomeIcon icon={faCalculator} className="text-purple-500 mr-2" />
                                Monte sua fórmula. Ex: <strong>([Vendas] / [Custos]) * 100</strong>.
                            </p>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="col-span-1 border-r border-gray-100 pr-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Variáveis Disponíveis</label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {kpisDisponiveis.length > 0 ? kpisDisponiveis.map(k => (
                                            <button key={k.id} onClick={() => inserirVariavel(k.titulo)} className="w-full text-left text-xs p-2 rounded hover:bg-gray-100 flex items-center justify-between group border border-transparent hover:border-gray-200">
                                                <span className="truncate text-gray-700 font-medium">{k.titulo}</span>
                                                <FontAwesomeIcon icon={faArrowUp} className="text-gray-300 group-hover:text-blue-500 transform rotate-45" />
                                            </button>
                                        )) : (
                                            <p className="text-xs text-gray-400 italic">Crie outros indicadores primeiro.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Expressão da Fórmula (Use nomes entre [ ])</label>
                                        <textarea value={formulaVisual} onChange={(e) => setFormulaVisual(e.target.value)} placeholder="Ex: [Vendas] / [Despesas Totais] * 100" className="w-full h-24 p-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50" />
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            {['+', '-', '*', '/', '(', ')', '100'].map(op => (
                                                <button key={op} onClick={() => setFormulaVisual(prev => prev + ` ${op} `)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-mono border">{op}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Formato do Resultado</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={formatoSaida === 'moeda'} onChange={() => setFormatoSaida('moeda')} className="text-purple-600" /><span className="text-sm text-gray-700">Moeda (R$)</span></label>
                                            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={formatoSaida === 'porcentagem'} onChange={() => setFormatoSaida('porcentagem')} className="text-purple-600" /><span className="text-sm text-gray-700">Porcentagem (%)</span></label>
                                            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={formatoSaida === 'numero'} onChange={() => setFormatoSaida('numero')} className="text-purple-600" /><span className="text-sm text-gray-700">Número</span></label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        )}

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={salvando} className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 disabled:opacity-50 transition-all transform hover:scale-105 flex items-center gap-2">
            {salvando ? <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</> : <><FontAwesomeIcon icon={faSave} /> Salvar Indicador</>}
          </button>
        </div>
      </div>
    </div>
  );
}