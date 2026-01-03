// components/painel/KpiBuilderModal.js
"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCheck, faChartPie, faArrowUp, faArrowDown, faWallet, faMoneyBillWave, faPiggyBank, faCoins, faExclamationTriangle, faSpinner, faPen } from '@fortawesome/free-solid-svg-icons';
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
  
  const [titulo, setTitulo] = useState('');
  const [iconeSelecionado, setIconeSelecionado] = useState('faWallet');
  const [corSelecionada, setCorSelecionada] = useState('#3B82F6');
  const [filtrosConfigurados, setFiltrosConfigurados] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (kpiToEdit) {
            setTitulo(kpiToEdit.titulo);
            const metaVisual = kpiToEdit.filtros?._meta_visual || {};
            setIconeSelecionado(metaVisual.icone || kpiToEdit.icone || 'faWallet');
            setCorSelecionada(metaVisual.cor || '#3B82F6');
            setFiltrosConfigurados(kpiToEdit.filtros || {});
        } else {
            setTitulo('');
            setIconeSelecionado('faWallet');
            setCorSelecionada('#3B82F6');
            setFiltrosConfigurados({});
        }
    }
  }, [isOpen, kpiToEdit]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast.warning("Dê um nome para o seu indicador!");
      return;
    }

    if (!user || !user.organizacao_id) {
        toast.error("Erro: Organização do usuário não identificada.");
        return;
    }

    setSalvando(true);
    try {
      const payload = {
        usuario_id: user.id,
        organizacao_id: user.organizacao_id,
        titulo: titulo,
        filtros: {
            ...filtrosConfigurados,
            _meta_visual: { cor: corSelecionada, icone: iconeSelecionado }
        },
        modulo: 'financeiro',
        tipo_calculo: 'soma_dinamica',
        exibir_no_painel: true,
        tipo_kpi: 'financeiro'
      };

      let error;

      if (kpiToEdit) {
        const response = await supabase
            .from('kpis_personalizados')
            .update(payload)
            .eq('id', kpiToEdit.id);
        error = response.error;
        if (!error) toast.success("Indicador atualizado!");

      } else {
        const response = await supabase
            .from('kpis_personalizados')
            .insert(payload);
        error = response.error;
        if (!error) toast.success("Indicador criado!");
      }

      if (error) throw error;

      if (onSaveSuccess) onSaveSuccess(); 
      onClose();
      setTitulo('');
      setFiltrosConfigurados({});
      
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar indicador.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      {/* MUDANÇA 1: Adicionei 'overflow-visible' no container principal do modal 
         para garantir que nada corte os dropdowns 
      */}
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-visible">
        
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
                {kpiToEdit ? 'Editar Indicador' : 'Novo Indicador Financeiro'}
            </h2>
            <p className="text-sm text-gray-500">
                {kpiToEdit ? 'Ajuste as regras ou aparência do seu card.' : 'Crie um card personalizado para acompanhar métricas.'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2">
            <FontAwesomeIcon icon={faTimes} className="text-xl" />
          </button>
        </div>

        {/* MUDANÇA 2: O corpo precisa ter 'overflow-y-auto' para scrollar se a tela for pequena,
           MAS para os dropdowns funcionarem bem, precisamos de espaço extra no fundo ou garantir
           que o dropdown não seja cortado.
           A melhor solução aqui é dar um padding-bottom extra para o dropdown ter espaço de abrir.
        */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
          
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-l-4 border-blue-500 pl-2">
              1. Identidade Visual
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Título do Indicador</label>
                    <input 
                        type="text" 
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        placeholder="Ex: Receita com Vendas..." 
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        autoFocus={!kpiToEdit} 
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cor do Destaque</label>
                    <div className="flex gap-3">
                        {OPCOES_CORES.map((cor) => (
                            <button
                                key={cor.id}
                                onClick={() => setCorSelecionada(cor.id)}
                                className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${cor.class} ${corSelecionada === cor.id ? 'ring-4 ring-offset-2 ring-gray-200 scale-110 shadow-md' : 'opacity-70 hover:opacity-100'}`}
                            >
                                {corSelecionada === cor.id && <FontAwesomeIcon icon={faCheck} className="text-white text-sm" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                    {OPCOES_ICONES.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => setIconeSelecionado(opt.id)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl min-w-[80px] border transition-all ${iconeSelecionado === opt.id ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                            <FontAwesomeIcon icon={opt.icon} className="text-xl mb-1" />
                            <span className="text-[10px] font-medium">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>
          </section>

          <section className="space-y-4 relative z-10">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-l-4 border-purple-500 pl-2">
              2. Regras de Cálculo
            </h3>
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500 mr-2" />
                Selecione abaixo o que deve ser somado.
            </p>
            
            {/* MUDANÇA CRÍTICA: Removi 'overflow-hidden' daqui! 
                Isso era o que estava cortando o dropdown. 
                Agora o dropdown pode "vazar" para fora da caixa cinza.
            */}
            <div className="border border-gray-200 rounded-xl relative">
                <FiltroFinanceiro 
                    onFilterChange={setFiltrosConfigurados} 
                    filtrosAtuais={filtrosConfigurados}
                    compacto={true}
                />
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3 z-20 relative">
          <button onClick={onClose} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={salvando}
            className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {salvando ? <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</> : <><FontAwesomeIcon icon={kpiToEdit ? faPen : faSave} /> {kpiToEdit ? 'Atualizar' : 'Criar'}</>}
          </button>
        </div>

      </div>
    </div>
  );
}