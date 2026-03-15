'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes, faSearch, faSpinner, faSave, faBoxOpen, faCheck,
  faBuilding, faCube
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function BimInsumoAvulsoModal({ isOpen, onClose, organizacaoId, empreendimentoId }) {
  const supabase = createClient();
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [materialSelecionado, setMaterialSelecionado] = useState(null);
  
  // Opcionais do vínculo
  const [quantidadeDesejada, setQuantidadeDesejada] = useState('0');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setBusca('');
    setResultados([]);
    setMaterialSelecionado(null);
    setQuantidadeDesejada('0');
  }, [isOpen]);

  const handleBuscar = async () => {
    if (busca.length < 3) return;
    
    setBuscando(true);
    setResultados([]);
    
    try {
      // Busca Material Próprio
      const { data: mData } = await supabase
        .from('materiais')
        .select('id, nome, unidade_medida, preco_unitario, classificacao')
        .eq('organizacao_id', organizacaoId)
        .ilike('nome', `%${busca}%`)
        .limit(20);

      // Busca SINAPI
      const { data: sData } = await supabase
        .from('sinapi')
        .select('id, nome, unidade_medida, preco_unitario, classificacao')
        .ilike('nome', `%${busca}%`)
        .limit(20);

      const items = [
        ...(mData || []).map(x => ({ ...x, origem: 'proprio' })),
        ...(sData || []).map(x => ({ ...x, origem: 'sinapi' }))
      ];

      // Ordenar por relevância / tamanho do nome
      items.sort((a, b) => a.nome.length - b.nome.length);
      setResultados(items);

    } catch (e) {
      console.error(e);
      toast.error('Erro ao buscar materiais.');
    } finally {
      setBuscando(false);
    }
  };

  const handleSalvar = async () => {
    if (!materialSelecionado) {
      toast.error('Selecione um material primeiro.');
      return;
    }

    setSalvando(true);

    try {
      // Quantidade fixa, que funcionará como fator_conversao uma vez que a prop_valor SQL para ele será 0
      // Mas para manter compatibilidade, vamos salvar a quantidade que ele quer no fator_conversao parseavel.
      const q = parseFloat(quantidadeDesejada.replace(',', '.'));
      const formatado = isNaN(q) ? '0' : q.toString();

      const payload = {
        organizacao_id: organizacaoId,
        tipo_vinculo: 'avulso', // Tag crucial para a SQL back-end
        propriedade_nome: 'Avulso', 
        propriedade_quantidade: null,
        escopo: 'projeto',
        material_id: materialSelecionado.origem === 'proprio' ? materialSelecionado.id : null,
        sinapi_id: materialSelecionado.origem === 'sinapi' ? materialSelecionado.id : null,
        fator_conversao: formatado,
        unidade_override: materialSelecionado.unidade_medida
      };

      const { error } = await supabase.from('bim_mapeamentos_propriedades').insert(payload);
      
      if (error) throw error;
      
      toast.success('Insumo avulso adicionado com sucesso!');
      onClose(); // Recarrega parent (o hook trará)
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar Insumo Avulso: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-emerald-50 text-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center text-emerald-600">
              <FontAwesomeIcon icon={faBoxOpen} />
            </div>
            <div>
              <h2 className="text-base font-bold">Adicionar Insumo Avulso</h2>
              <p className="text-xs text-emerald-600 font-medium">Itens de orçamento que não possuem representação 3D direta no modelo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full text-emerald-500 hover:bg-emerald-200 transition-colors flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5 max-h-[60vh]">
          {/* BUSCA */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">1. Selecione o Material / Serviço</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Ex: Cimento, Servente, Tábua, Topografia..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                />
              </div>
              <button
                onClick={handleBuscar}
                disabled={buscando || busca.length < 3}
                className="px-4 py-2 bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 text-sm rounded border border-slate-300 transition-colors"
              >
                {buscando ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Buscar'}
              </button>
            </div>
          </div>

          {/* LISTA RESULTADOS */}
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded min-h-[250px] overflow-hidden flex flex-col">
            {!resultados.length && !buscando && !materialSelecionado && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm gap-2 p-4 text-center">
                <FontAwesomeIcon icon={faSearch} className="text-2xl text-slate-300 mb-1" />
                Busque por um material na base de dados (SINAPI ou Própria).
              </div>
            )}
            
            {buscando && (
              <div className="flex-1 flex flex-col items-center justify-center text-emerald-500 text-sm gap-3">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl" />
                Pesquisando base de dados...
              </div>
            )}

            {!buscando && resultados.length > 0 && !materialSelecionado && (
              <div className="overflow-y-auto w-full p-2 space-y-1 max-h-[300px]">
                {resultados.map((mat) => (
                  <button
                    key={mat.origem + '_' + mat.id}
                    onClick={() => setMaterialSelecionado(mat)}
                    className="w-full text-left bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 p-3 rounded group transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            mat.origem === 'sinapi' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {mat.origem}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">{mat.classificacao || 'GERAL'}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight group-hover:text-emerald-800 transition-colors">
                          {mat.nome}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block mb-1">
                          {mat.unidade_medida || 'UN'}
                        </div>
                        <div className="text-xs font-bold text-emerald-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.preco_unitario || 0)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ITEM SELECIONADO VIEW */}
            {materialSelecionado && (
              <div className="p-4 flex flex-col h-full bg-emerald-50/50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-emerald-500" />
                    Material / Serviço Selecionado
                  </h3>
                  <button 
                    onClick={() => setMaterialSelecionado(null)}
                    className="text-[10px] font-bold text-slate-500 hover:text-red-500 underline"
                  >
                    Trocar material
                  </button>
                </div>
                
                <div className="bg-white p-4 border border-emerald-200 rounded shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      materialSelecionado.origem === 'sinapi' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {materialSelecionado.origem}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">{materialSelecionado.classificacao || 'GERAL'}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{materialSelecionado.nome}</p>
                  <p className="text-emerald-700 font-bold mt-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(materialSelecionado.preco_unitario || 0)}
                    <span className="text-xs text-slate-500 font-medium ml-1 block mt-0.5">por {materialSelecionado.unidade_medida || 'UN'}</span>
                  </p>
                </div>

                {/* CAMPO DE QUANTIDADE FIXA (VERBA INICIAL) */}
                <div className="mt-5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">2. Quantidade Inicial Estimada <span className="lowercase font-normal text-slate-400 text-[10px]">(Ficará independente na planilha)</span></label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={quantidadeDesejada}
                      onChange={e => setQuantidadeDesejada(e.target.value)}
                      placeholder="Ex: 50.0"
                      className="w-32 px-3 py-2 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-700 bg-white"
                      step="0.01"
                      min="0"
                    />
                    <span className="text-sm font-bold text-slate-500 bg-slate-200 px-3 py-2 rounded">{materialSelecionado.unidade_medida || 'UN'}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Você poderá usar o painel de <b>Gerenciar Vínculo</b> posteriormente para atrelar a "Quantidade" deste insumo diretamente à quantidade de algum outro item do modelo!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!materialSelecionado || salvando}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {salvando ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            Adicionar na Planilha
          </button>
        </div>
      </div>
    </div>
  );
}
