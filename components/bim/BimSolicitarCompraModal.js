import { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes, faTrash, faSpinner, faCheckCircle, 
  faShoppingCart, faExclamationTriangle, faInfoCircle,
  faLayerGroup, faPlus
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { enviarNotificacao } from '@/utils/notificacoes';

export default function BimSolicitarCompraModal({
  isOpen,
  onClose,
  itensSelecionados, // array de objetos de materiais selecionados do orçamento
  empreendimento,    // objeto do empreendimento ativo { id, nome }
  organizacaoId,
  usuarioId,
  onSucesso,         // callback executado após criação do pedido para limpar seleções, etc.
}) {
  const supabase = createClient();

  const [tituloPedido, setTituloPedido] = useState('');
  const [listaItens, setListaItens] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  
  // Estados para fase inicial
  const [faseId, setFaseId] = useState(null);
  const [statusNome, setStatusNome] = useState('Pedido Realizado');
  const [carregandoFase, setCarregandoFase] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Inicializa o modal
  useEffect(() => {
    if (isOpen && empreendimento) {
      const dataStr = new Date().toLocaleDateString('pt-BR');
      setTituloPedido(`Solicitação BIM - ${empreendimento.nome} - ${dataStr}`);
      
      // Mapeia os itens selecionados para a lista editável com a quantidadeSolicitada padrão
      const itensMapeados = (itensSelecionados || []).map(item => ({
        ...item,
        // Garante que a quantidade inicial solicitada seja a orçada
        quantidadeSolicitada: item.quantidade || 0
      }));
      setListaItens(itensMapeados);
      setObservacoes('');
    }
  }, [isOpen, itensSelecionados, empreendimento]);

  // Busca reativa da fase inicial de compras
  useEffect(() => {
    async function obterFaseInicial() {
      if (!organizacaoId) return;
      try {
        setCarregandoFase(true);
        // Busca fases cadastradas para esta organização, matriz (1) ou fallback (2)
        const { data: fasesData, error: fasesError } = await supabase
          .from('pedidos_fases')
          .select('*')
          .in('organizacao_id', [Number(organizacaoId), 1, 2])
          .order('ordem', { ascending: true });

        if (fasesError) throw fasesError;

        let faseInicial = null;
        if (fasesData && fasesData.length > 0) {
          // 1. Tenta pegar da própria organização
          const fasesOrg = fasesData.filter(f => f.organizacao_id === Number(organizacaoId));
          if (fasesOrg.length > 0) {
            faseInicial = fasesOrg[0];
          } else {
            // 2. Se não tem, clona as fases da Matriz (igual o page.js de compras/pedidos faz)
            const fasesMatriz = fasesData.filter(f => f.organizacao_id === 1);
            const fasesFallback = fasesMatriz.length > 0 ? fasesMatriz : fasesData.filter(f => f.organizacao_id === 2);
            
            if (fasesFallback.length > 0) {
              const novasFases = fasesFallback.map(f => ({
                nome: f.nome,
                slug: f.slug,
                ordem: f.ordem,
                finalizado: f.finalizado,
                organizacao_id: Number(organizacaoId)
              }));
              
              const { data: insertedFases, error: insertError } = await supabase
                .from('pedidos_fases')
                .insert(novasFases)
                .select()
                .order('ordem', { ascending: true });

              if (!insertError && insertedFases && insertedFases.length > 0) {
                faseInicial = insertedFases[0];
              } else if (fasesFallback.length > 0) {
                faseInicial = fasesFallback[0];
              }
            }
          }
        }

        if (faseInicial) {
          setFaseId(faseInicial.id);
          setStatusNome(faseInicial.nome);
        } else {
          setFaseId(null);
          setStatusNome('Pedido Realizado');
        }
      } catch (err) {
        console.error('Erro ao buscar fase inicial de pedidos:', err);
      } finally {
        setCarregandoFase(false);
      }
    }

    if (isOpen) {
      obterFaseInicial();
    }
  }, [isOpen, organizacaoId]);

  // Altera a quantidade solicitada de um item
  const handleAlterarQtd = (key, valor) => {
    setListaItens(prev => prev.map(item => {
      if (item.key === key) {
        return { ...item, quantidadeSolicitada: valor };
      }
      return item;
    }));
  };

  // Remove um item da lista a ser solicitada
  const handleRemoverItem = (key) => {
    setListaItens(prev => prev.filter(item => item.key !== key));
  };

  // Calcula o valor total estimado do pedido de compras
  const valorTotalPedido = useMemo(() => {
    return listaItens.reduce((acc, item) => {
      const preco = parseFloat(item.preco_unitario) || 0;
      const qtd = parseFloat(item.quantidadeSolicitada) || 0;
      return acc + (preco * qtd);
    }, 0);
  }, [listaItens]);

  // Envia a solicitação para o Supabase
  const handleConfirmarSolicitacao = async () => {
    if (!tituloPedido.trim()) {
      toast.error('Informe um título para a solicitação de compra.');
      return;
    }
    if (listaItens.length === 0) {
      toast.error('Nenhum item na lista para solicitar.');
      return;
    }

    // Valida se todas as quantidades são válidas
    const temQtdInvalida = listaItens.some(item => {
      const q = parseFloat(item.quantidadeSolicitada);
      return isNaN(q) || q <= 0;
    });

    if (temQtdInvalida) {
      toast.error('Verifique as quantidades. Devem ser números maiores que zero.');
      return;
    }

    try {
      setSalvando(true);

      // 1. Criar o pedido de compra pai
      const payloadPedido = {
        empreendimento_id: empreendimento.id,
        solicitante_id: usuarioId,
        data_solicitacao: new Date().toISOString(),
        status: statusNome || 'Pedido Realizado',
        fase_id: faseId || null,
        titulo: tituloPedido.trim(),
        valor_total_estimado: valorTotalPedido,
        organizacao_id: Number(organizacaoId),
        observacoes: observacoes.trim() || null
      };

      const { data: pedidoSalvo, error: erroPedido } = await supabase
        .from('pedidos_compra')
        .insert(payloadPedido)
        .select('id')
        .single();

      if (erroPedido) throw erroPedido;

      const pedidoId = pedidoSalvo.id;

      // 2. Criar os itens do pedido
      const payloadItens = listaItens.map(item => {
        const preco = parseFloat(item.preco_unitario) || 0;
        const qtd = parseFloat(item.quantidadeSolicitada) || 0;
        return {
          pedido_compra_id: pedidoId,
          material_id: item.material_id || null, // pode ser nulo se for SINAPI sem FK direto
          descricao_item: item.nome,
          quantidade_solicitada: qtd,
          unidade_medida: item.unidade || 'un',
          preco_unitario_real: preco,
          custo_total_real: preco * qtd,
          etapa_id: item.etapa_id || null,
          subetapa_id: item.subetapa_id || null,
          organizacao_id: Number(organizacaoId)
        };
      });

      const { error: erroItens } = await supabase
        .from('pedidos_compra_itens')
        .insert(payloadItens);

      if (erroItens) throw erroItens;

      // 3. Disparar notificação operacional no sistema
      try {
        await enviarNotificacao({
          userId: usuarioId,
          titulo: "📝 Solicitação de Compra via BIM",
          mensagem: `Nova solicitação #${pedidoId} criada a partir do Orçamento BIM.`,
          link: `/pedidos`,
          organizacaoId: Number(organizacaoId),
          canal: 'operacional'
        });
      } catch (errNotif) {
        console.error('Falha ao enviar notificação operacional:', errNotif);
      }

      toast.success(`Solicitação de compra #${pedidoId} enviada com sucesso!`, {
        duration: 8000,
        action: {
          label: 'Ver no Painel',
          onClick: () => {
            // Abre o painel de compras
            window.location.href = '/pedidos';
          }
        }
      });

      if (onSucesso) {
        onSucesso();
      }
      onClose();
    } catch (err) {
      toast.error('Erro ao enviar solicitação de compra.');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-gray-100 max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 bg-slate-50">
          <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200">
              <FontAwesomeIcon icon={faShoppingCart} className="text-base" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Solicitar Material para Compra</h2>
              <p className="text-xs font-semibold text-gray-500 mt-1 leading-none">
                Gere um pedido de compra a partir dos quantitativos do modelo 3D
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors flex items-center justify-center -mt-2 -mr-2"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* CORPO */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Título do Pedido de Compra
              </label>
              <input
                type="text"
                value={tituloPedido}
                onChange={e => setTituloPedido(e.target.value)}
                placeholder="Ex: Pedido de Aço Pilares da Laje"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-800 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Empreendimento Vinculado
              </label>
              <div className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold">
                {empreendimento?.nome || 'Nenhum'}
              </div>
            </div>
          </div>

          {/* Banner de Status Inicial */}
          <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg flex items-center justify-between text-xs text-blue-800">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500" />
              <span className="font-medium">
                Este pedido será iniciado na coluna: <strong>{statusNome}</strong>
              </span>
            </div>
            {carregandoFase && (
              <FontAwesomeIcon icon={faSpinner} spin className="text-blue-400" />
            )}
          </div>

          {/* Lista de Materiais */}
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">
              Itens a serem Solicitados ({listaItens.length})
            </label>
            
            {listaItens.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-400 text-2xl mb-2" />
                <p className="text-xs font-bold text-gray-500">Nenhum item na lista para solicitar.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 text-[10px] uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Material</th>
                      <th className="px-3 py-2.5 text-center w-16">Unid.</th>
                      <th className="px-4 py-2.5 text-right w-28">Qtd. Orçada</th>
                      <th className="px-4 py-2.5 text-right w-36">Qtd. Solicitada</th>
                      <th className="px-4 py-2.5 text-right w-28">Preço Est.</th>
                      <th className="px-4 py-2.5 text-right w-32">Total Est.</th>
                      <th className="px-3 py-2.5 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listaItens.map(item => {
                      const preco = parseFloat(item.preco_unitario) || 0;
                      const qtd = parseFloat(item.quantidadeSolicitada) || 0;
                      const subtotal = preco * qtd;

                      return (
                        <tr key={item.key} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-700 leading-tight">{item.nome}</p>
                            {item.etapa_nome && (
                              <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                                <FontAwesomeIcon icon={faLayerGroup} className="text-[8px]" />
                                {item.etapa_nome} {item.subetapa_nome ? `› ${item.subetapa_nome}` : ''}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="bg-slate-100 text-slate-650 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase font-mono">
                              {item.unidade || 'un'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 font-semibold">
                            {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.quantidade || 0)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={item.quantidadeSolicitada}
                                onChange={e => handleAlterarQtd(item.key, e.target.value)}
                                className="w-24 text-right text-xs p-1 border border-slate-300 rounded font-bold text-blue-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-blue-50/10"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 font-medium">
                            {preco > 0 
                              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco) 
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 font-bold">
                            {subtotal > 0 
                              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal) 
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoverItem(item.key)}
                              className="w-7 h-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex items-center justify-center"
                              title="Remover este item do pedido"
                            >
                              <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {valorTotalPedido > 0 && (
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right text-[10px] text-slate-500 uppercase">
                          Soma Estimada do Pedido:
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-black text-emerald-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalPedido)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Observações Gerais */}
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
              Observações Gerais do Pedido (Opcional)
            </label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Digite observações sobre entrega, marcas preferenciais, urgência ou outras diretrizes para o comprador..."
              rows={3}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 font-medium bg-white"
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmarSolicitacao}
            disabled={salvando || listaItens.length === 0}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {salvando ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                Enviando Solicitação...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faCheckCircle} />
                Confirmar e Solicitar Compras
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
