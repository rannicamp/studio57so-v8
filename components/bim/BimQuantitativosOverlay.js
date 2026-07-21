'use client';

import { useState, useMemo, useRef, useEffect, Fragment, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faCubes, faChevronDown, faChevronUp, faChevronRight, faSpinner, faHome,
 faBuilding, faCheck, faLayerGroup, faRuler, faRulerCombined,
 faFileExport, faArrowRight, faAngleDown, faAngleRight,
 faTriangleExclamation, faBoxOpen, faExpand, faCompress,
 faSearch, faBarcode, faLink, faBan, faRuler as faRulerIcon,
 faDollarSign, faExclamationTriangle, faChevronRight as faChevRight, faFileInvoiceDollar, faCube,
 faShoppingCart, faFilter, faColumns
} from '@fortawesome/free-solid-svg-icons';
import { useBimQuantitativos } from '@/hooks/bim/useBimQuantitativos';
import { useBimMapeamentos } from '@/hooks/bim/useBimMapeamentos';
import { toast } from 'sonner';
import BimImportModal from '@/components/orcamento/BimImportModal';
import BimVinculoMaterialModal from '@/components/bim/BimVinculoMaterialModal';
import BimVinculoSimplificadoModal from '@/components/bim/BimVinculoSimplificadoModal';
import BimGerenciarVinculosModal from '@/components/bim/BimGerenciarVinculosModal';
import BimInsumoAvulsoModal from '@/components/bim/BimInsumoAvulsoModal';
import BimElementPropertiesModal from '@/components/bim/BimElementPropertiesModal';
import BimSolicitarCompraModal from '@/components/bim/BimSolicitarCompraModal';
import BimFilterPanel from '@/components/bim/BimFilterPanel';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

const fmt2 = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const extrairPropriedadesAcumuladas = (elementos) => {
  const acumulados = {};
  const configUnidades = {
    'Volume': 'm³',
    'Área': 'm²',
    'Area': 'm²',
    'Comprimento': 'm',
    'Length': 'm',
    'Espessura': 'm',
    'Largura': 'm',
    'Altura': 'm',
    'Height': 'm',
    'Diâmetro': 'mm',
    'Diâmetro interno': 'mm',
    'DN': 'mm'
  };

  (elementos || []).forEach(el => {
    const props = el.propriedades || {};
    Object.entries(props).forEach(([chave, valor]) => {
      const valorNum = parseFloat(valor);
      if (isNaN(valorNum) || valorNum <= 0) return;
      
      let unidade = configUnidades[chave];
      let nomeExibicao = chave;

      // Fallback dinâmico para concreto do Eberick/AltoQi (Ex: "Concreto - C-40 - Abatimento 5 cm...")
      if (!unidade && (chave.toLowerCase().startsWith('concreto -') || chave.toLowerCase().includes('concreto - c'))) {
        unidade = 'm³';
        nomeExibicao = 'Volume de Concreto';
      }

      if (unidade) {
        if (!acumulados[nomeExibicao]) {
          acumulados[nomeExibicao] = {
            nome: nomeExibicao,
            valor: 0,
            unidade: unidade
          };
        }
        acumulados[nomeExibicao].valor += valorNum;
      }
    });
  });

  return Object.values(acumulados);
};

const BadgeStatus = ({ status }) => {
 const cfg = {
 processado: 'bg-green-50 text-green-700 border-green-200',
 ativo: 'bg-green-50 text-green-700 border-green-200',
 processando: 'bg-amber-50 text-amber-700 border-amber-200',
 pendente: 'bg-gray-50 text-gray-500 border-gray-200',
 };
 const cls = cfg[status?.toLowerCase()] || cfg['pendente'];
 return (
 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase border ${cls}`}>
 {status || 'Disponível'}
 </span>
 );
 };

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function BimQuantitativosOverlay({ viewer, onClose, onShowInModel, empreendimentoContextId, modelosContextIds, isSidebarVisible = true }) {
 const supabase = createClient();
 const { organizacao_id, user } = useAuth();

 const [elementosFiltradosDb, setElementosFiltradosDb] = useState(null);
 const [isDropdownEmpAberto, setIsDropdownEmpAberto] = useState(false);
 const [isBimModalAberto, setIsBimModalAberto] = useState(false);
 const [buscaElemento, setBuscaElemento] = useState('');
 const [medidasSelecionadas, setMedidasSelecionadas] = useState({});
 const [abaAtiva, setAbaAtiva] = useState('elementos'); // 'elementos' | 'por-material'
 const [apenasNaoMapeados, setApenasNaoMapeados] = useState(false);
 const [categoriaFiltro, setCategoriaFiltro] = useState('');
 const [regrasFiltro, setRegrasFiltro] = useState([]);
 const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
 const [tipoVisualizacao, setTipoVisualizacao] = useState('etapa'); // 'etapa' | 'categoria' | 'material'
 const [ordenacaoCampo, setOrdenacaoCampo] = useState(null); // 'nome' | 'quantidade' | 'preco' | 'custo' | null
 const [ordenacaoDirecao, setOrdenacaoDirecao] = useState('asc'); // 'asc' | 'desc'
 const dropdownRef = useRef(null);

 // Estados para seleção de itens e modal de compras
 const [itensSelecionados, setItensSelecionados] = useState({});
 const [isSolicitarCompraModalAberto, setIsSolicitarCompraModalAberto] = useState(false);

 // Orçamentos etapas
 const { data: etapas = [] } = useQuery({
 queryKey: ['etapas', organizacao_id],
 queryFn: async () => {
 const { data } = await supabase
 .from('etapa_obra')
 .select('id, nome_etapa, codigo_etapa')
 .eq('organizacao_id', organizacao_id)
 .order('codigo_etapa');
 return data || [];
 },
 enabled: !!organizacao_id,
 staleTime: 10 * 60 * 1000,
 });

 // BIM: grupos + controles
 const {
 empreendimentosAgrupados, carregandoEmpreendimentos,
 empreendimentoSelecionadoId, empreendimentoSelecionado, handleSelectEmpreendimento,
 modelos, carregandoModelos,
 modelosSelecionadosIds, modelosSelecionados, handleSelectModelos,
 grupos, carregandoElementos, kpis,
 categoriasExpandidas, setCategoriasExpandidas, toggleCategoria, expandirTodas, recolherTodas,
 todosElementos, // flat do modelo selecionado (para o modal de preview)
 todosElementosEmpreendimento, // flat de TODOS os modelos do empreendimento (para Por Material)
 carregandoElementosEmp,
 carregarFamiliasDaCategoria,
 carregarDetalhesFamilia,
 carregandoTodosElementos,
 } = useBimQuantitativos({ organizacaoId: organizacao_id });

 // Mapeamentos BIM → Materiais
 // Usa todosElementosEmpreendimento para somar TODOS os modelos do empreendimento
 const {
 mapeamentos,
 criarMapeamento,
 deletarMapeamento,
 resolverMapeamento,
 quantitativoPorMaterial,
 carregandoQuantitativoPorMaterial,
 quantitativoPorCategoria,
 carregandoQuantitativoPorCategoria,
 kpisMaterial,
 atualizarFatorMaterial,
 propriedadesMapeadas,
 entregasPorMaterial,
 carregandoEntregas,
 } = useBimMapeamentos({
 organizacaoId: organizacao_id,
 empreendimentoId: empreendimentoSelecionadoId,
 modelosIds: modelosSelecionadosIds,
 });

 // ─── Sincronização de Contexto com o BIM Manager ───────────────────────────
 useEffect(() => {
 if (empreendimentoContextId && String(empreendimentoContextId) !== String(empreendimentoSelecionadoId)) {
 handleSelectEmpreendimento(String(empreendimentoContextId));
 }
 }, [empreendimentoContextId, empreendimentoSelecionadoId, handleSelectEmpreendimento]);

  useEffect(() => {
    const incomingIds = (modelosContextIds || []).map(String).sort().join(',');
    const currentIds = modelosSelecionadosIds.map(String).sort().join(',');
    if (incomingIds !== currentIds) {
      handleSelectModelos((modelosContextIds || []).map(String));
    }
  }, [modelosContextIds, modelosSelecionadosIds, handleSelectModelos]);

  // Helper para aplicar ordenação de colunas em uma lista de materiais
  const ordenarMateriais = useCallback((lista) => {
    if (!ordenacaoCampo) return lista;
    const copia = [...lista];
    copia.sort((a, b) => {
      let valorA, valorB;
      if (ordenacaoCampo === 'nome') {
        valorA = (a.nome || '').toLowerCase();
        valorB = (b.nome || '').toLowerCase();
        return ordenacaoDirecao === 'asc' 
          ? valorA.localeCompare(valorB) 
          : valorB.localeCompare(valorA);
      } else if (ordenacaoCampo === 'preco') {
        valorA = Number(a.preco_unitario) || 0;
        valorB = Number(b.preco_unitario) || 0;
      } else if (ordenacaoCampo === 'quantidade') {
        valorA = Number(a.quantidade) || 0;
        valorB = Number(b.quantidade) || 0;
      } else if (ordenacaoCampo === 'custo') {
        valorA = Number(a.custo_total) || 0;
        valorB = Number(b.custo_total) || 0;
      }
      return ordenacaoDirecao === 'asc' ? valorA - valorB : valorB - valorA;
    });
    return copia;
  }, [ordenacaoCampo, ordenacaoDirecao]);

  // Helper de Ordenação Hierárquica para Composições Filhas
  const organizarMateriaisHierarquico = useCallback((listaMateriais) => {
    const mapaItens = new Map(listaMateriais.map(m => [m.mapeamento_id, m]));
    const mapaItensPorMaterial = new Map(listaMateriais.map(m => [m.material_id, m]));
    const mapaItensPorSinapi = new Map(listaMateriais.map(m => [m.sinapi_id, m]));
    
    // Função para verificar se o pai de um item está presente na lista
    const temPaiNaLista = (item) => {
      if (item.pai_mapeamento_id && mapaItens.has(item.pai_mapeamento_id)) return true;
      if (item.pai_material_id && mapaItensPorMaterial.has(item.pai_material_id)) return true;
      if (item.pai_sinapi_id && mapaItensPorSinapi.has(item.pai_sinapi_id)) return true;
      return false;
    };
    
    // Os pais de primeiro nível são os que não têm pai de forma alguma, ou cujos pais não estão na lista
    let paisRaiz = listaMateriais.filter(m => !m.pai_mapeamento_id && !m.pai_material_id && !m.pai_sinapi_id);
    
    // E também os órfãos cujos pais não estão presentes na lista (eles viram raízes!)
    const orfaosDePaiAusente = listaMateriais.filter(m => 
      (m.pai_mapeamento_id || m.pai_material_id || m.pai_sinapi_id) && !temPaiNaLista(m)
    ).map(o => ({
      ...o,
      pai_mapeamento_id: null,
      pai_material_id: null,
      pai_sinapi_id: null,
      nivel: 1, // Viram nível 1!
      is_orfao: true
    }));
    
    // Une as duas listas de raízes
    let raizes = [...paisRaiz, ...orfaosDePaiAusente];
    
    // Ordena as raízes
    if (ordenacaoCampo) {
      raizes = ordenarMateriais(raizes);
    } else {
      raizes.sort((a, b) => b.custo_total - a.custo_total);
    }
    
    // Todos os outros itens são potenciais filhos de algum nível
    const todosOsFilhos = listaMateriais.filter(m => temPaiNaLista(m) && (m.pai_mapeamento_id || m.pai_material_id || m.pai_sinapi_id));
    
    const resultado = [];
    
    // Função recursiva para coletar descendentes em pré-ordem
    const coletarDescendentes = (paiItem) => {
      // Acha todos os filhos diretos deste pai
      let filhosDiretos = todosOsFilhos.filter(f => 
        f.pai_mapeamento_id === paiItem.mapeamento_id ||
        (paiItem.material_id && f.pai_material_id === paiItem.material_id) ||
        (paiItem.sinapi_id && f.pai_sinapi_id === paiItem.sinapi_id)
      );
      
      // Ordena os filhos diretos
      if (ordenacaoCampo) {
        filhosDiretos = ordenarMateriais(filhosDiretos);
      } else {
        filhosDiretos.sort((a, b) => b.custo_total - a.custo_total);
      }
      
      // Para cada filho, adiciona-o ao resultado e busca recursivamente os descendentes dele!
      filhosDiretos.forEach(filho => {
        resultado.push(filho);
        coletarDescendentes(filho);
      });
    };
    
    // Percorre cada raiz, adiciona no resultado e recolhe os seus descendentes recursivamente
    raizes.forEach(raiz => {
      resultado.push(raiz);
      coletarDescendentes(raiz);
    });
    
    return resultado;
  }, [ordenacaoCampo, ordenarMateriais]);

  // Helper para renderizar o cabeçalho ordenável de forma consistente
  const renderHeaderOrdenavel = (campo, label, alignClass = "text-right") => {
    const isAtivo = ordenacaoCampo === campo;
    return (
      <button
        onClick={() => {
          if (ordenacaoCampo === campo) {
            if (ordenacaoDirecao === 'asc') {
              setOrdenacaoDirecao('desc');
            } else {
              setOrdenacaoCampo(null);
            }
          } else {
            setOrdenacaoCampo(campo);
            setOrdenacaoDirecao('asc');
          }
        }}
        className={`group inline-flex items-center gap-1.5 focus:outline-none hover:text-blue-600 transition-colors font-bold uppercase tracking-wider text-xs ${
          isAtivo ? 'text-blue-600' : 'text-gray-500'
        }`}
      >
        <span>{label}</span>
        <span className={`text-[10px] transition-all ${isAtivo ? 'opacity-100 font-bold' : 'opacity-0 group-hover:opacity-50'}`}>
          {isAtivo ? (ordenacaoDirecao === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </button>
    );
  };

  // ─── Agrupamento de Orçamento por Etapas ─────────────────────────────────────
  const quantitativosAgrupados = useMemo(() => {
    const grupos = {};
    const termo = buscaElemento.trim().toLowerCase();

    // Filtra o array original
    const itensFiltrados = quantitativoPorMaterial.filter(item => {
      if (!termo) return true;
      const nomeMaterial = (item.nome || '').toLowerCase();
      const nomeEtapa = (item.etapa_nome || '').toLowerCase();
      const nomeSubetapa = (item.subetapa_nome || '').toLowerCase();
      const strMaterialId = String(item.material_id || '').toLowerCase();
      const strSinapiId = String(item.sinapi_id || '').toLowerCase();
      return nomeMaterial.includes(termo) || 
             nomeEtapa.includes(termo) || 
             nomeSubetapa.includes(termo) || 
             strMaterialId === termo || 
             strSinapiId === termo;
    });

    itensFiltrados.forEach(item => {
      const eId = item.etapa_id || 'sem_etapa';
      const eNome = item.etapa_nome || 'Sem Etapa Vinculada';
      const sId = item.subetapa_id || 'sem_subetapa';
      const sNome = item.subetapa_nome || '';

      if (!grupos[eId]) {
        grupos[eId] = {
          etapa_id: eId,
          etapa_nome: eNome,
          custo_total: 0,
          tem_alertas: false,
          subetapas: {}
        };
      }
      if (!grupos[eId].subetapas[sId]) {
        grupos[eId].subetapas[sId] = {
          subetapa_id: sId,
          subetapa_nome: sNome,
          custo_total: 0,
          materiais: []
        };
      }

      grupos[eId].custo_total += item.custo_total;
      if (item.tem_alertas) grupos[eId].tem_alertas = true;
      grupos[eId].subetapas[sId].custo_total += item.custo_total;
      grupos[eId].subetapas[sId].materiais.push(item);
    });

    const etapasOrdenadas = Object.values(grupos).sort((a, b) => {
      if (a.etapa_id === 'sem_etapa') return 1;
      if (b.etapa_id === 'sem_etapa') return -1;
      return a.etapa_nome.localeCompare(b.etapa_nome);
    });

    etapasOrdenadas.forEach(et => {
      // Ordena as subetapas colocando 'sem_subetapa' no topo, e as demais em ordem alfabética de nome
      const subetapasOrdenadas = Object.values(et.subetapas).sort((a, b) => {
        if (a.subetapa_id === 'sem_subetapa') return -1;
        if (b.subetapa_id === 'sem_subetapa') return 1;
        return (a.subetapa_nome || '').localeCompare(b.subetapa_nome || '');
      });
      et.subetapasLista = subetapasOrdenadas;

      subetapasOrdenadas.forEach(sub => {
        sub.materiais = organizarMateriaisHierarquico(sub.materiais);
      });
    });

    return etapasOrdenadas;
  }, [quantitativoPorMaterial, buscaElemento, organizarMateriaisHierarquico]);

  // ─── Agrupamento de Orçamento por Categoria Revit ─────────────────────────────
  const quantitativosPorCategoria = useMemo(() => {
    const grupos = {};
    const termo = buscaElemento.trim().toLowerCase();

    // Filtra o array original
    const itensFiltrados = quantitativoPorCategoria.filter(item => {
      if (!termo) return true;
      const nomeMaterial = (item.nome || '').toLowerCase();
      const nomeCategoria = (item.categoria_nome || '').toLowerCase();
      return nomeMaterial.includes(termo) || nomeCategoria.includes(termo);
    });

    itensFiltrados.forEach(item => {
      const catNome = item.categoria_nome || 'Materiais do Projeto';

      if (!grupos[catNome]) {
        grupos[catNome] = {
          categoria_nome: catNome,
          custo_total: 0,
          tem_alertas: false,
          materiaisMap: {}
        };
      }

      const g = grupos[catNome];
      g.custo_total += item.custo_total;
      if (item.tem_alertas) g.tem_alertas = true;

      // Define a chave única do material dentro desta categoria
      const keyMaterial = item.material_id 
        ? `mat_${item.material_id}` 
        : (item.sinapi_id ? `sinapi_${item.sinapi_id}` : `nome_${item.nome}`);

      if (!g.materiaisMap[keyMaterial]) {
        g.materiaisMap[keyMaterial] = {
          key: `${catNome}_${keyMaterial}`,
          nome: item.nome,
          unidade: item.unidade,
          preco_unitario: item.preco_unitario,
          classificacao: item.classificacao,
          quantidade: 0,
          qtd_elementos: 0,
          external_ids_ativos: [],
          external_ids_inativos: [],
          custo_total: 0,
          tem_alertas: false,
          origem: item.origem,
          is_avulso: item.is_avulso,
          material_id: item.material_id,
          sinapi_id: item.sinapi_id,
          mapeamento_id: item.mapeamento_id,
          pai_mapeamento_id: item.pai_mapeamento_id,
          fator_conversao: item.fator_conversao,
          quantidadeOriginalApenasParaInfo: 0
        };
      }

      const mat = g.materiaisMap[keyMaterial];
      mat.quantidade += item.quantidade;
      mat.qtd_elementos += item.qtd_elementos;
      mat.custo_total += item.custo_total;
      if (item.tem_alertas) mat.tem_alertas = true;
      if (item.quantidadeOriginalApenasParaInfo) {
        mat.quantidadeOriginalApenasParaInfo += item.quantidadeOriginalApenasParaInfo;
      } else if (item.fator_conversao) {
        mat.quantidadeOriginalApenasParaInfo += item.quantidadeOriginalApenasParaInfo || item.quantidade;
      }

      // Concatena os arrays de IDs de forma única
      if (item.external_ids_ativos) {
        item.external_ids_ativos.forEach(id => {
          if (!mat.external_ids_ativos.includes(id)) mat.external_ids_ativos.push(id);
        });
      }
      if (item.external_ids_inativos) {
        item.external_ids_inativos.forEach(id => {
          if (!mat.external_ids_inativos.includes(id)) mat.external_ids_inativos.push(id);
        });
      }
    });

    const listaGrupos = Object.values(grupos).map(g => {
      const materiaisOrdenados = organizarMateriaisHierarquico(Object.values(g.materiaisMap));
      return {
        categoria_nome: g.categoria_nome,
        custo_total: g.custo_total,
        tem_alertas: g.tem_alertas,
        materiais: materiaisOrdenados
      };
    });

    return listaGrupos.sort((a, b) => {
      if (a.categoria_nome === 'Materiais do Projeto') return 1;
      if (b.categoria_nome === 'Materiais do Projeto') return -1;
      return a.categoria_nome.localeCompare(b.categoria_nome);
    });
  }, [quantitativoPorCategoria, buscaElemento, organizarMateriaisHierarquico]);

  // ─── Agrupamento de Orçamento por Material Consolidado ────────────────────────
  const quantitativosPorMaterialConsolidado = useMemo(() => {
    const grupos = {};
    const termo = buscaElemento.trim().toLowerCase();

    // Filtra o array original
    const itensFiltrados = quantitativoPorMaterial.filter(item => {
      if (!termo) return true;
      const nomeMaterial = (item.nome || '').toLowerCase();
      const nomeClassificacao = (item.classificacao || '').toLowerCase();
      const strMaterialId = String(item.material_id || '').toLowerCase();
      const strSinapiId = String(item.sinapi_id || '').toLowerCase();
      return nomeMaterial.includes(termo) || 
             nomeClassificacao.includes(termo) || 
             strMaterialId === termo || 
             strSinapiId === termo;
    });

    itensFiltrados.forEach(item => {
      const keyMaterial = item.material_id 
        ? `mat_${item.material_id}` 
        : (item.sinapi_id ? `sinapi_${item.sinapi_id}` : `nome_${item.nome}`);

      if (!grupos[keyMaterial]) {
        grupos[keyMaterial] = {
          key: keyMaterial,
          nome: item.nome,
          unidade: item.unidade,
          preco_unitario: item.preco_unitario,
          classificacao: item.classificacao,
          quantidade: 0,
          qtd_elementos: 0,
          external_ids_ativos: [],
          external_ids_inativos: [],
          custo_total: 0,
          tem_alertas: false,
          origem: item.origem,
          is_avulso: item.is_avulso,
          material_id: item.material_id,
          sinapi_id: item.sinapi_id
        };
      }

      const g = grupos[keyMaterial];
      g.quantidade += item.quantidade;
      g.qtd_elementos += item.qtd_elementos;
      g.custo_total += item.custo_total;
      if (item.tem_alertas) g.tem_alertas = true;

      if (item.external_ids_ativos) {
        item.external_ids_ativos.forEach(id => {
          if (!g.external_ids_ativos.includes(id)) g.external_ids_ativos.push(id);
        });
      }
      if (item.external_ids_inativos) {
        item.external_ids_inativos.forEach(id => {
          if (!g.external_ids_inativos.includes(id)) g.external_ids_inativos.push(id);
        });
      }
    });

    let listaConsolidada = Object.values(grupos);

    // Se houver ordenação ativa, aplica a ordenação no array consolidado
    if (ordenacaoCampo) {
      listaConsolidada = ordenarMateriais(listaConsolidada);
    } else {
      listaConsolidada.sort((a, b) => b.custo_total - a.custo_total);
    }

    return listaConsolidada;
  }, [quantitativoPorMaterial, buscaElemento, ordenacaoCampo, ordenarMateriais]);

  // ─── Lógica Auxiliar de Seleção de Materiais para Compras ──────────────────────
  
  // Computa de forma reativa todos os materiais visíveis na planilha de acordo com a visão selecionada
  const itensVisiveis = useMemo(() => {
    if (tipoVisualizacao === 'material') {
      return quantitativosPorMaterialConsolidado || [];
    } else if (tipoVisualizacao === 'categoria') {
      return (quantitativosPorCategoria || []).flatMap(g => g.materiais || []);
    } else { // 'etapa'
      return (quantitativosAgrupados || []).flatMap(g => 
        (g.subetapasLista || []).flatMap(s => s.materiais || [])
      );
    }
  }, [tipoVisualizacao, quantitativosPorMaterialConsolidado, quantitativosPorCategoria, quantitativosAgrupados]);

  // Verifica se todos os itens de materiais visíveis estão selecionados
  const todosSelecionados = useMemo(() => {
    if (itensVisiveis.length === 0) return false;
    return itensVisiveis.every(item => !!itensSelecionados[item.key]);
  }, [itensVisiveis, itensSelecionados]);

  // Alterna a seleção de um único item
  const handleToggleSelecionarItem = (item) => {
    setItensSelecionados(prev => {
      const novo = { ...prev };
      if (novo[item.key]) {
        delete novo[item.key];
      } else {
        novo[item.key] = item;
      }
      return novo;
    });
  };

  // Seleciona ou desmarca todos os materiais visíveis
  const handleToggleSelecionarTodos = () => {
    if (todosSelecionados) {
      setItensSelecionados(prev => {
        const novo = { ...prev };
        itensVisiveis.forEach(item => {
          delete novo[item.key];
        });
        return novo;
      });
    } else {
      setItensSelecionados(prev => {
        const novo = { ...prev };
        itensVisiveis.forEach(item => {
          novo[item.key] = item;
        });
        return novo;
      });
    }
  };

  const renderMaterialRow = (item, paddingClass = "pl-12") => {
    const nivelProfundidade = Number(item.nivel) || 1;
    const isFilho = nivelProfundidade > 1;
    const paddingCels = isFilho ? "bg-slate-50/25" : paddingClass;
    const estaSelecionado = !!itensSelecionados[item.key];

    const quantidadeEntregue = item.material_id ? (entregasPorMaterial[item.material_id] || 0) : null;
    let classeCor = "";
    let iconeAlerta = null;
    if (quantidadeEntregue !== null) {
      if (quantidadeEntregue < item.quantidade) {
        classeCor = "text-amber-700 bg-amber-50 border border-amber-200/60";
      } else if (Math.abs(quantidadeEntregue - item.quantidade) < 0.001) {
        classeCor = "text-emerald-700 bg-emerald-50 border border-emerald-200/60";
      } else {
        classeCor = "text-red-700 bg-red-50 border border-red-200/60";
        iconeAlerta = (
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="text-red-500 mr-1 animate-pulse"
            title="Quantidade entregue é superior à projetada!"
          />
        );
      }
    }

    return (
      <tr
        key={item.key}
        className={`border-b border-gray-100 hover:bg-slate-50/50 transition-colors ${
          item.tem_alertas ? 'bg-amber-50/20' : (isFilho ? 'bg-slate-50/10' : estaSelecionado ? 'bg-blue-50/10' : 'bg-white')
        }`}
      >
        {/* Checkbox de Seleção */}
        <td className="px-4 py-2 text-center w-10">
          <input
            type="checkbox"
            checked={estaSelecionado}
            onChange={() => handleToggleSelecionarItem(item)}
            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer animate-in fade-in"
          />
        </td>
        <td className={`px-4 py-2 ${paddingCels} border-l-2 ${isFilho ? 'border-emerald-300' : 'border-transparent'} hover:border-blue-400`}>
          <div 
            className="flex items-center gap-2" 
            style={isFilho ? { paddingLeft: `${(nivelProfundidade - 1) * 16}px` } : {}}
          >
            {isFilho && (
              <span className="text-emerald-500 font-extrabold text-[11px] select-none mr-1" title={`Subitem nível ${nivelProfundidade - 1}`}>
                └─
              </span>
            )}
            {item.tem_alertas && (
              <span title={`${item.external_ids_inativos.length} elementos removidos do modelo`}>
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-400 text-[10px]" />
              </span>
            )}
            <div>
              <p className={`text-xs ${isFilho ? 'font-medium text-slate-600' : 'font-semibold text-gray-700'}`}>{item.nome}</p>
              {item.tem_alertas && (
                <p className="text-[9px] text-amber-600">
                  {item.external_ids_inativos.length} elem. removidos do 3D
                </p>
              )}
              {isFilho && (
                <p className="text-[8px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded inline-block mt-0.5" title="A quantidade desta linha depende da quantidade de outro Material">
                  <FontAwesomeIcon icon={faLink} className="mr-1 text-[7px]" />
                  Subitem N{nivelProfundidade - 1}
                </p>
              )}
              {item.is_avulso && !isFilho && (
                <p className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5" title="Foi adicionado manualmente e possui quantidade travada">
                  <FontAwesomeIcon icon={faBoxOpen} className="mr-1" />
                  Avulso Inicial
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2 text-center">
          <BadgeUnidade unidade={item.unidade} />
        </td>
        <td className="px-4 py-2 text-right">
          {item.fator_conversao ? (
            <div className="flex flex-col items-end cursor-pointer group" onClick={() => handleEditFator(item)}>
              <span className="text-[9px] text-gray-400 font-semibold strike-through line-through decorative group-hover:text-blue-400 transition-colors">
                {fmt2(item.quantidadeOriginalApenasParaInfo)}
              </span>
              <span className="font-bold text-blue-700 bg-blue-50/50 px-1 py-0.5 rounded group-hover:bg-blue-100 transition-colors" title={`Fórmula: ${item.fator_conversao} (Clique para editar)`}>
                {fmt2(item.quantidade)}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-gray-700 cursor-pointer hover:text-blue-600 border-b border-dashed border-transparent hover:border-blue-400 transition-colors"
              onClick={() => handleEditFator(item)}
              title="Adicionar conversão"
            >
              {fmt2(item.quantidade)}
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          {quantidadeEntregue === null ? (
            <span className="text-gray-300">—</span>
          ) : (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold ${classeCor}`} title={`Projetado: ${fmt2(item.quantidade)}`}>
              {iconeAlerta}
              {fmt2(quantidadeEntregue)}
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-right text-gray-400 text-[10px]">
          {item.preco_unitario > 0
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-2 text-right">
          {item.preco_unitario > 0 ? (
            <span className="text-xs font-bold text-emerald-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.custo_total)}
            </span>
          ) : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-2 text-center">
          {item.is_avulso && !item.pai_mapeamento_id ? (
            <div className="text-[10px] text-slate-400 font-semibold" title="Sem amarração com modelo 3D">
              -
            </div>
          ) : (
            <div className="flex bg-blue-50 border border-blue-100 rounded overflow-hidden shadow-sm mx-auto w-max">
              <span className="text-blue-600 text-[10px] font-bold px-2 py-1.5 border-r border-blue-100">
                {item.qtd_elementos}
              </span>
              <button onClick={() => handleShowInModel(item.external_ids_ativos, item.nome)}
                className="px-2 py-1 bg-white hover:bg-blue-600 text-blue-500 hover:text-white transition-colors"
                title="Ver no 3D"
              >
                <FontAwesomeIcon icon={faCubes} className="text-[10px]" />
              </button>
            </div>
          )}
        </td>
        <td className="px-4 py-2 text-center">
          <button
            onClick={() => setMaterialGerenciar(item)}
            className="w-7 h-7 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center"
            title="Gerenciar Vínculos"
          >
            <FontAwesomeIcon icon={faLink} className="text-xs" />
          </button>
        </td>
      </tr>
    );
  };

 const [etapasRecolhidas, setEtapasRecolhidas] = useState(new Set());
 const toggleEtapaOrcamento = (id) => setEtapasRecolhidas(prev => {
 const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
 });

  // Modais / Seletoes (Vínculo & Exclusão)
  const [vinculoModal, setVinculoModal] = useState(null);
  const [inspecaoModal, setInspecaoModal] = useState(null);
  const [insumoAvulsoModalOpen, setInsumoAvulsoModalOpen] = useState(false);
  const [materialGerenciar, setMaterialGerenciar] = useState(null);

  const [linhaDestacadaChave, setLinhaDestacadaChave] = useState(null);

  const handleVincularPropriedadeDeElemento = (propNome, propValor, elemento) => {
    setInspecaoModal(null);
    
    const detectarUnidadeLocal = (nome) => {
      const l = (nome || '').toLowerCase();
      if (l.includes('volume'))      return 'm³';
      if (l.includes('área') || l.includes('area')) return 'm²';
      if (l.includes('comprimento') || l.includes('length')) return 'm';
      if (l.includes('diâmetro') || l.includes('diametro')) return 'mm';
      return 'un';
    };

    setVinculoModal({
      propriedade: {
        nome: propNome,
        valor: propValor,
        unidade: detectarUnidadeLocal(propNome)
      },
      elemento: elemento
    });
  };

  // Handlers locais envelopados para aplicar a animação (piscada verde) de sucesso
  const handleSalvarMapeamento = async (payload) => {
    try {
      const res = await criarMapeamento(payload);
      let chaveDestacada = null;
      if (payload.escopo === 'tipo' && payload.tipo_bim) {
        chaveDestacada = tipoChave(payload.categoria_bim, payload.familia_bim, payload.tipo_bim);
      } else if (payload.escopo === 'familia' && payload.familia_bim) {
        chaveDestacada = `fam-${payload.categoria_bim}|||${payload.familia_bim}`;
      } else if (payload.escopo === 'categoria' && payload.categoria_bim) {
        chaveDestacada = `cat-${payload.categoria_bim}`;
      } else if (payload.escopo === 'elemento' && payload.elemento_id) {
        const elObj = todosElementos.find(el => String(el.external_id) === String(payload.elemento_id));
        if (elObj) {
          chaveDestacada = `el-${elObj.id}`;
        }
      }
      if (chaveDestacada) {
        setLinhaDestacadaChave(chaveDestacada);
        setTimeout(() => setLinhaDestacadaChave(null), 2000);
      }
      return res;
    } catch (e) {
      console.error('[Overlay] Erro ao salvar mapeamento:', e);
      throw e;
    }
  };

  const handleExcluirMapeamento = async (id) => {
    try {
      const mapeamento = mapeamentos.find(m => m.id === id);
      const res = await deletarMapeamento(id);
      if (mapeamento) {
        let chaveDestacada = null;
        if (mapeamento.escopo === 'tipo' && mapeamento.tipo_bim) {
          chaveDestacada = tipoChave(mapeamento.categoria_bim, mapeamento.familia_bim, mapeamento.tipo_bim);
        } else if (mapeamento.escopo === 'familia' && mapeamento.familia_bim) {
          chaveDestacada = `fam-${mapeamento.categoria_bim}|||${mapeamento.familia_bim}`;
        } else if (mapeamento.escopo === 'categoria' && mapeamento.categoria_bim) {
          chaveDestacada = `cat-${mapeamento.categoria_bim}`;
        } else if (mapeamento.escopo === 'elemento' && mapeamento.elemento_id) {
          const elObj = todosElementos.find(el => String(el.external_id) === String(mapeamento.elemento_id));
          if (elObj) {
            chaveDestacada = `el-${elObj.id}`;
          }
        }
        if (chaveDestacada) {
          setLinhaDestacadaChave(chaveDestacada);
          setTimeout(() => setLinhaDestacadaChave(null), 2000);
        }
      }
      return res;
    } catch (e) {
      console.error('[Overlay] Erro ao excluir mapeamento:', e);
      throw e;
    }
  };

 // Função para editar fator de conversao via prompt nativo
 const handleEditFator = async (item) => {
 const textoAtual = item.fator_conversao || '';
 const formulaHelp = 'Escreva a matemática usando [q] para representar a quantidade originada do modelo.\nExemplo: [q] / 12 (divide por 12).\nDeixe em branco para remover a fórmula.';
 const novo = window.prompt(`Fórmula de conversão para "${item.nome}":\n\n${formulaHelp}`, textoAtual);
 if (novo === null) return; // usuário cancelou
 try {
 await atualizarFatorMaterial({
 id: item.material_id || item.sinapi_id,
 origem: item.material_id ? 'proprio' : 'sinapi',
 novoFator: novo
 });
 } catch (e) {
 alert('Erro ao salvar nova fórmula.');
 console.error(e);
 }
 };

  // Auxiliares para destacar e isolar elementos 3D a partir das ramificações
  const selecionarCategoriaNo3D = (cat, silent = false) => {
    let ids = (cat.familias || []).flatMap(f => (f.tipos || []).flatMap(t => (t.elementos || []).map(el => el.external_id)));
    if (ids.length === 0) {
      const elementosCat = todosElementos.filter(el => el.categoria === cat.categoria);
      ids = elementosCat.map(el => el.external_id);
    }
    if (ids.length === 0) {
      const toastId = toast.loading(`Buscando elementos da categoria ${cat.categoria}...`);
      
      const buscar = async () => {
        let acumulados = [];
        let temMais = true;
        let pagina = 0;
        const limite = 1000;
        
        while (temMais) {
          const { data, error } = await supabase
            .from('elementos_bim')
            .select('external_id')
            .in('projeto_bim_id', modelosSelecionadosIds.map(Number))
            .eq('categoria', cat.categoria)
            .range(pagina * limite, (pagina + 1) * limite - 1);
            
          if (error) throw error;
          if (!data || data.length === 0) {
            temMais = false;
          } else {
            acumulados = [...acumulados, ...data.map(el => el.external_id)];
            if (data.length < limite) {
              temMais = false;
            } else {
              pagina++;
            }
          }
        }
        return acumulados;
      };

      buscar()
        .then((queryIds) => {
          toast.dismiss(toastId);
          if (queryIds.length > 0) {
            handleShowInModel(queryIds, cat.categoria, silent);
          } else {
            toast.warning('Nenhum elemento associado encontrado para exibir.');
          }
        })
        .catch((error) => {
          toast.dismiss(toastId);
          console.error(error);
          toast.error(`Erro ao buscar elementos da categoria.`);
        });
    } else {
      handleShowInModel(ids, cat.categoria, silent);
    }
  };

  const selecionarFamiliaNo3D = (cat, fam, silent = false) => {
    let ids = (fam.tipos || []).flatMap(t => (t.elementos || []).map(el => el.external_id));
    if (ids.length === 0) {
      const elementosFam = todosElementos.filter(el => el.categoria === cat.categoria && el.familia === fam.familia);
      ids = elementosFam.map(el => el.external_id);
    }
    if (ids.length === 0) {
      const toastId = toast.loading(`Buscando elementos da família ${fam.familia}...`);
      
      const buscar = async () => {
        let acumulados = [];
        let temMais = true;
        let pagina = 0;
        const limite = 1000;
        
        while (temMais) {
          const { data, error } = await supabase
            .from('elementos_bim')
            .select('external_id')
            .in('projeto_bim_id', modelosSelecionadosIds.map(Number))
            .eq('categoria', cat.categoria)
            .eq('familia', fam.familia)
            .range(pagina * limite, (pagina + 1) * limite - 1);
            
          if (error) throw error;
          if (!data || data.length === 0) {
            temMais = false;
          } else {
            acumulados = [...acumulados, ...data.map(el => el.external_id)];
            if (data.length < limite) {
              temMais = false;
            } else {
              pagina++;
            }
          }
        }
        return acumulados;
      };

      buscar()
        .then((queryIds) => {
          toast.dismiss(toastId);
          if (queryIds.length > 0) {
            handleShowInModel(queryIds, fam.familia, silent);
          } else {
            toast.warning('Nenhum elemento associado encontrado para exibir.');
          }
        })
        .catch((error) => {
          toast.dismiss(toastId);
          console.error(error);
          toast.error(`Erro ao buscar elementos da família.`);
        });
    } else {
      handleShowInModel(ids, fam.familia, silent);
    }
  };

  const selecionarTipoNo3D = (cat, fam, t, silent = false) => {
    const ids = (t.elementos || []).map(el => el.external_id);
    if (ids.length === 0) {
      const toastId = toast.loading(`Buscando elementos do tipo ${t.tipo}...`);
      
      const buscar = async () => {
        let acumulados = [];
        let temMais = true;
        let pagina = 0;
        const limite = 1000;
        
        while (temMais) {
          const { data, error } = await supabase
            .from('elementos_bim')
            .select('external_id')
            .in('projeto_bim_id', modelosSelecionadosIds.map(Number))
            .eq('categoria', cat.categoria)
            .eq('familia', fam.familia)
            .eq('tipo', t.tipo)
            .range(pagina * limite, (pagina + 1) * limite - 1);
            
          if (error) throw error;
          if (!data || data.length === 0) {
            temMais = false;
          } else {
            acumulados = [...acumulados, ...data.map(el => el.external_id)];
            if (data.length < limite) {
              temMais = false;
            } else {
              pagina++;
            }
          }
        }
        return acumulados;
      };

      buscar()
        .then((queryIds) => {
          toast.dismiss(toastId);
          if (queryIds.length > 0) {
            handleShowInModel(queryIds, t.tipo, silent);
          } else {
            toast.warning('Nenhum elemento associado encontrado para exibir.');
          }
        })
        .catch((error) => {
          toast.dismiss(toastId);
          console.error(error);
          toast.error(`Erro ao buscar elementos do tipo.`);
        });
    } else {
      handleShowInModel(ids, t.tipo, silent);
    }
  };

 // Enviar comando ao BIM Manager para destacar os elementos (silent adicionado)
 const handleShowInModel = (externalIds, label, silent = false) => {
 if (!externalIds || externalIds.length === 0) {
 toast.warning('Nenhum elemento associado encontrado para exibir.');
 return;
 }
 // Chama a prop passando dados ao invés de usar localStorage/router
 if (onShowInModel) {
 onShowInModel(externalIds, label, modelos, silent);
 }
 };

 // Fecha dropdown ao clicar fora
 useEffect(() => {
 const handle = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownEmpAberto(false); };
 document.addEventListener('mousedown', handle);
 return () => document.removeEventListener('mousedown', handle);
 }, []);

  // Reset medidas ao trocar modelo
  useEffect(() => {
  setMedidasSelecionadas({});
  }, [modelosSelecionadosIds]);

 // Estado para elementos expandidos (chave = 'cat|||fam|||tipo')
 const [tiposExpandidos, setTiposExpandidos] = useState(new Set());
 const toggleTipoExpandido = (chave) => setTiposExpandidos(prev => {
 const s = new Set(prev); s.has(chave) ? s.delete(chave) : s.add(chave); return s;
 });

  // Estado para famílias expandidas dentro de uma categoria
  const [familiasExpandidas, setFamiliasExpandidas] = useState(new Set());
  const toggleFamiliaExpandida = (chave) => {
    const [categoria, familia] = chave.split('|||');
    carregarDetalhesFamilia(categoria, familia);
    setFamiliasExpandidas(prev => {
      const s = new Set(prev);
      s.has(chave) ? s.delete(chave) : s.add(chave);
      return s;
    });
  };

 // Helper: chave única por tipo
 const tipoChave = (cat, fam, tipo) => `${cat}|||${fam}|||${tipo}`;

 // Helper: obtém a medida ativa de um tipo
 const getMedidaAtiva = (cat, fam, t) => {
 const chave = tipoChave(cat, fam, t.tipo);
 const escolhida = medidasSelecionadas[chave];
 if (escolhida && t.medidas.find(m => m.chave === escolhida)) {
 return t.medidas.find(m => m.chave === escolhida);
 }
 return t.medidas[0] || null;
 };

 // Badge padronizado para unidade (mesma aparência, cor por tipo)
 const UNIDADE_COR = {
 'm³': 'bg-blue-50 text-blue-700 border-blue-200',
 'm²': 'bg-blue-50 text-blue-700 border-blue-200',
 'm': 'bg-blue-50 text-blue-700 border-blue-200',
 'mm': 'bg-gray-50 text-gray-700 border-gray-200',
 'un': 'bg-gray-50 text-gray-655 border-gray-200',
 };
 const BadgeUnidade = ({ unidade, ativo = true, onClick }) => {
 const cor = UNIDADE_COR[unidade] || UNIDADE_COR['un'];
 const base = `text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all`;
 const estado = ativo
 ? `${cor} ring-2 ring-offset-1 ring-current/20`
 : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600';
 return onClick
 ? <button onClick={onClick} className={`${base} ${estado} cursor-pointer`}>{unidade}</button>
 : <span className={`${base} ${cor}`}>{unidade}</span>;
 };

 // ─── Sidebar de detalhes ─────────────────────────────────────────────────
 const [sidebarItem, setSidebarItem] = useState(null);
 // sidebarItem = { tipo: 'familia' | 'tipo' | 'elemento', dados: {...}, cat, fam }

 const fecharSidebar = () => setSidebarItem(null);

 // Ao trocar modelo, fecha sidebar
 useEffect(() => { setSidebarItem(null); }, [modelosSelecionadosIds]);

  // Helper para verificar se um tipo de elemento possui mapeamento de orçamento (BIM 2.0)
  const tipoTemMapeamento = useMemo(() => {
    const chavesMapeadas = new Set();
    mapeamentos.forEach(m => {
      if (m.escopo === 'categoria') {
        chavesMapeadas.add(`cat:${m.categoria_bim}`);
      } else if (m.escopo === 'familia') {
        chavesMapeadas.add(`fam:${m.categoria_bim}|||${m.familia_bim}`);
      } else if (m.escopo === 'tipo') {
        chavesMapeadas.add(`tipo:${m.categoria_bim}|||${m.familia_bim}|||${m.tipo_bim}`);
      } else if (m.escopo === 'elemento') {
        chavesMapeadas.add(`el:${m.elemento_id}`);
      }
    });

    return (cat, fam, t) => {
      if (chavesMapeadas.has(`cat:${cat}`)) return true;
      if (chavesMapeadas.has(`fam:${cat}|||${fam}`)) return true;
      if (chavesMapeadas.has(`tipo:${cat}|||${fam}|||${t.tipo}`)) return true;
      return false;
    };
  }, [mapeamentos]);

  // O estado elementosFiltradosDb é gerenciado diretamente pelo componente unificado BimFilterPanel (onFilterApplied / onFilterCleared)

  // Set de IDs compatíveis para busca rápida O(1)
  const matchingIdsSet = useMemo(() => {
    if (!elementosFiltradosDb) return null;
    const set = new Set();
    elementosFiltradosDb.forEach(e => {
      if (e.external_id) set.add(String(e.external_id));
      if (e.id) set.add(String(e.id));
    });
    return set;
  }, [elementosFiltradosDb]);

  // Efeito que carrega automaticamente famílias e detalhes dos elementos que bateram na busca no DB
  useEffect(() => {
    if (elementosFiltradosDb && elementosFiltradosDb.length > 0) {
      const catFamSet = new Set();
      elementosFiltradosDb.forEach(el => {
        if (el.categoria && el.familia) {
          catFamSet.add(`${el.categoria}|||${el.familia}`);
          carregarFamiliasDaCategoria(el.categoria);
        }
      });

      catFamSet.forEach(catFamKey => {
        const [c, f] = catFamKey.split('|||');
        carregarDetalhesFamilia(c, f);
      });

      setCategoriasExpandidas(prev => {
        const next = new Set(prev);
        elementosFiltradosDb.forEach(el => {
          if (el.categoria) next.add(el.categoria);
        });
        return next;
      });
    }
  }, [elementosFiltradosDb, carregarFamiliasDaCategoria, carregarDetalhesFamilia]);

  // Filtra grupos por busca e toggle não mapeados — agora com estrutura 3 níveis e suporte a regras do DB
  const gruposFiltrados = useMemo(() => {
    let resultado = grupos;

    if (categoriaFiltro) {
      resultado = resultado.filter(cat => cat.categoria === categoriaFiltro);
    }

    if (apenasNaoMapeados) {
      resultado = resultado
        .map(cat => ({
          ...cat,
          familias: cat.familias
            .map(f => ({
              ...f,
              tipos: f.tipos.filter(t => !tipoTemMapeamento(cat.categoria, f.familia, t))
            }))
            .filter(f => f.tipos.length > 0)
        }))
        .filter(cat => cat.familias.length > 0);
    }

    // Regras Dinâmicas de Filtro (Filtragem por resultado do Banco Supabase)
    if (elementosFiltradosDb !== null && matchingIdsSet) {
      const familiasMatchingSet = new Set(elementosFiltradosDb.map(e => `${e.categoria}|||${e.familia}`));
      const tiposMatchingSet = new Set(elementosFiltradosDb.map(e => `${e.categoria}|||${e.familia}|||${e.tipo}`));

      const MEDIDAS_CONFIG = [
        { chave: 'Volume',           unidade: 'm³',  label: 'Volume' },
        { chave: 'Área',             unidade: 'm²',  label: 'Área' },
        { chave: 'Area',             unidade: 'm²',  label: 'Área' },
        { chave: 'Comprimento',      unidade: 'm',   label: 'Comprimento' },
        { chave: 'Espessura',        unidade: 'm',   label: 'Espessura' },
        { chave: 'Largura',          unidade: 'm',   label: 'Largura' },
        { chave: 'Diâmetro',         unidade: 'mm',  label: 'Diâmetro' },
        { chave: 'Diâmetro interno', unidade: 'mm',  label: 'Diâm. Interno' },
        { chave: 'DN',               unidade: 'mm',  label: 'DN' },
      ];

      const buildMedidasFiltradas = (elementos) => {
        const acumuladores = {};
        elementos.forEach(el => {
          const props = el.propriedades || {};
          MEDIDAS_CONFIG.forEach(({ chave }) => {
            const val = parseFloat(props[chave]);
            if (isNaN(val) || val <= 0) return;
            if (!acumuladores[chave]) acumuladores[chave] = { soma: 0, qtd_com_valor: 0 };
            acumuladores[chave].soma += val;
            acumuladores[chave].qtd_com_valor += 1;
          });

          // Concreto AltoQi/Eberick
          Object.entries(props).forEach(([chave, valor]) => {
            const val = parseFloat(valor);
            if (isNaN(val) || val <= 0) return;
            if (chave.toLowerCase().startsWith('concreto -') || chave.toLowerCase().includes('concreto - c')) {
              const chaveAcum = 'Volume';
              if (!acumuladores[chaveAcum]) acumuladores[chaveAcum] = { soma: 0, qtd_com_valor: 0 };
              acumuladores[chaveAcum].soma += val;
              acumuladores[chaveAcum].qtd_com_valor += 1;
            }
          });
        });

        return MEDIDAS_CONFIG
          .filter(cfg => acumuladores[cfg.chave]?.qtd_com_valor > 0)
          .reduce((acc, cfg) => {
            const acum = acumuladores[cfg.chave];
            if (!acc.find(m => m.unidade === cfg.unidade && m.label === cfg.label)) {
              acc.push({
                chave: cfg.chave,
                label: cfg.label,
                unidade: cfg.unidade,
                valor: acum.soma,
                qtd_com_valor: acum.qtd_com_valor
              });
            }
            return acc;
          }, [])
          .sort((a, b) => b.qtd_com_valor - a.qtd_com_valor);
      };

      resultado = resultado
        .map(cat => ({
          ...cat,
          familias: (cat.familias || [])
            .filter(f => familiasMatchingSet.has(`${cat.categoria}|||${f.familia}`))
            .map(f => ({
              ...f,
              tipos: (f.tipos || [])
                .filter(t => tiposMatchingSet.has(`${cat.categoria}|||${f.familia}|||${t.tipo}`))
                .map(t => {
                  const elementosFiltrados = (t.elementos || []).filter(el => 
                    matchingIdsSet.has(String(el.id)) || matchingIdsSet.has(String(el.external_id))
                  );
                  const medidasFiltradas = buildMedidasFiltradas(elementosFiltrados);

                  return {
                    ...t,
                    elementos: elementosFiltrados,
                    medidas: medidasFiltradas,
                    medida_padrao: medidasFiltradas[0]?.chave || null,
                    qtd_total: elementosFiltrados.length,
                    external_ids: elementosFiltrados.map(e => e.external_id)
                  };
                })
                .filter(t => t.elementos.length > 0)
            }))
            .filter(f => f.tipos.length > 0)
        }))
        .filter(cat => cat.familias.length > 0);
    }

    if (buscaElemento.trim()) {
      const termo = buscaElemento.toLowerCase();
      resultado = resultado
        .map(cat => ({
          ...cat,
          familias: cat.familias
            .map(f => ({
              ...f,
              tipos: f.tipos.filter(t =>
                f.familia.toLowerCase().includes(termo) ||
                t.tipo.toLowerCase().includes(termo) ||
                (t.sinapi_revit && t.sinapi_revit.toLowerCase().includes(termo))
              )
            }))
            .filter(f => f.tipos.length > 0)
        }))
        .filter(cat => cat.familias.length > 0);
    }

    return resultado;
  }, [grupos, categoriaFiltro, elementosFiltradosDb, matchingIdsSet, buscaElemento, apenasNaoMapeados, tipoTemMapeamento]);

  // Lista de categorias únicas extraídas dos grupos para o select de filtro
  const listaCategoriasUnicas = useMemo(() => {
    return (grupos || []).map(cat => cat.categoria).filter(Boolean);
  }, [grupos]);

  // Propriedades disponíveis para busca customizada extraídas dos elementos carregados
  const propriedadesDisponiveis = useMemo(() => {
    const propsSet = new Set();
    (todosElementos || []).forEach(el => {
      if (el.propriedades) {
        Object.keys(el.propriedades).forEach(k => propsSet.add(k));
      }
    });
    return Array.from(propsSet);
  }, [todosElementos]);

 // Helper: soma medidas de uma lista de tipos
 const somarMedidas = (tipos) => {
 const acum = {};
 tipos.forEach(t => {
 t.medidas.forEach(m => {
 if (!acum[m.chave]) acum[m.chave] = { ...m, valor: 0, qtd_com_valor: 0 };
 acum[m.chave].valor += m.valor;
 acum[m.chave].qtd_com_valor += m.qtd_com_valor;
 });
 });
 return Object.values(acum).sort((a, b) => b.qtd_com_valor - a.qtd_com_valor);
 };

 // ─────────────────────────────────────────────────────────────────────────
 // Componente Sidebar de Detalhes (inline)
 // ─────────────────────────────────────────────────────────────────────────
 const SidebarDetalhes = () => {
 if (!sidebarItem) return null;
 const { tipo: nivel, dados, cat, fam } = sidebarItem;

 // Cor do cabeçalho por nível
 const headerCor = nivel === 'familia' ? 'bg-blue-600'
 : nivel === 'tipo' ? 'bg-indigo-600'
 : 'bg-amber-600';

 // Título dinâmico
 const titulo = nivel === 'familia' ? `Família: ${dados.familia}`
 : nivel === 'tipo' ? `Tipo: ${dados.tipo}`
 : `Elemento: ${dados.external_id}`;

 // Calcula medidas a exibir
 const medidasExibir = nivel === 'familia'
 ? somarMedidas(dados.tipos)
 : nivel === 'tipo'
 ? dados.medidas
 : []; // Elementos: exibe propriedades brutas

 const props = nivel === 'elemento' ? (dados.propriedades || {}) : null;
 const propKeys = props ? Object.keys(props).sort() : [];

 return (
 <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-slide-in-right">
 {/* Header */}
 <div className={`${headerCor} text-white px-5 py-4 flex items-start justify-between`}>
 <div>
 <p className="text-[10px] uppercase tracking-widest font-semibold opacity-75">
 {cat}{fam ? ` › ${fam}` : ''}
 </p>
 <h2 className="text-sm font-bold mt-0.5 leading-snug">{titulo}</h2>
 </div>
 <button
 onClick={fecharSidebar}
 className="text-white/70 hover:text-white text-lg leading-none ml-4 mt-0.5 hover:bg-white/20 w-7 h-7 rounded flex items-center justify-center transition-all"
 >×</button>
 </div>

 {/* Conteúdo */}
 <div className="flex-1 overflow-y-auto">

 {/* Medidas (para Família e Tipo) */}
 {medidasExibir.length > 0 && (
 <div className="px-5 py-4 border-b border-gray-100">
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Quantidades</p>
 <div className="grid grid-cols-2 gap-2">
 {medidasExibir.map(m => (
 <div key={m.chave} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-105">
 <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{m.label}</p>
 <p className="text-base font-bold text-gray-800 mt-0.5">
 {fmt2(m.valor)} <span className="text-[10px] font-normal text-gray-400">{m.unidade}</span>
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Contagem de instâncias */}
 <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
 <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
 {nivel === 'familia' ? dados.total_elementos
 : nivel === 'tipo' ? dados.qtd_total
 : 1} inst.
 </span>
 {nivel === 'tipo' && dados.sinapi_revit && (
 <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded border border-indigo-100 font-mono">
 SINAPI {dados.sinapi_revit}
 </span>
 )}
 </div>

 {/* Para Família: lista os tipos */}
 {nivel === 'familia' && (
 <div className="px-5 py-4">
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tipos nesta família</p>
 <div className="space-y-1.5">
 {dados.tipos.map(t => (
 <button
 key={t.tipo}
 onClick={() => setSidebarItem({ tipo: 'tipo', dados: t, cat, fam: dados.familia })}
 className="w-full text-left bg-gray-55 hover:bg-blue-50 border border-gray-105 hover:border-blue-200 rounded-lg px-3 py-2 transition-all"
 >
 <p className="text-xs font-semibold text-gray-700">{t.tipo}</p>
 <p className="text-[10px] text-gray-400 mt-0.5">
 {t.qtd_total} inst. &middot; {t.medidas[0] ? `${fmt2(t.medidas[0].valor)} ${t.medidas[0].unidade}` : 'Sem medida'}
 </p>
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Renderização de instâncias no sidebar REMOVIDA (agora expande direto na tabela) */}

 {/* Para Elemento: todas as propriedades brutas + botões de vínculo */}
 {nivel === 'elemento' && (
 <div className="px-5 py-4">
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Propriedades do Revit</p>
 <div className="space-y-0 border border-gray-105 rounded-lg overflow-hidden">
 {propKeys.map((k, i) => {
 const jaMapeada = propriedadesMapeadas.has(k);
 const valNum = parseFloat(props[k]);
 const temValor = !isNaN(valNum) && valNum > 0;
 return (
 <div
 key={k}
 className={`flex items-center gap-2 px-3 py-2 text-xs ${
   i % 2 === 0 ? 'bg-white' : 'bg-gray-55'
 } group hover:bg-blue-50/50 transition-colors`}
 >
 <span className="text-gray-500 font-medium shrink-0 max-w-[40%] truncate" title={k}>{k}</span>
 <span className="text-gray-800 font-semibold flex-1 text-right truncate" title={String(props[k])}>
 {String(props[k])}
 </span>
 {/* Botões de vínculo — só apareçem quando o campo tem valor numérico */}
 {temValor && (
 <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
 {jaMapeada ? (
 <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">
 vinculado
 </span>
 ) : (
 <button
 onClick={() => setVinculoModal({
 propriedade: { nome: k, valor: valNum },
 elemento: dados,
 })}
 title="Vincular ao material"
 className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-bold transition-all flex items-center gap-1"
 >
 <FontAwesomeIcon icon={faLink} /> vincular
 </button>
 )}
 </div>
 )}
 </div>
 );
 })}
 {propKeys.length === 0 && (
 <p className="text-xs text-gray-400 p-4 text-center">Nenhuma propriedade registrada.</p>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
 };

 // ─── Render ────────────────────────────────────────────────────────────────

  return (
  <div className="w-full h-full flex flex-col bg-gray-50 overflow-hidden font-sans animate-in fade-in duration-200">

  {/* ══════════════ HEADER ══════════════ */}
  <header className={`bg-white border-b border-gray-200 py-4 flex items-center justify-between gap-4 flex-shrink-0 shadow-sm relative overflow-hidden transition-all duration-300 ${isSidebarVisible ? 'px-6' : 'pl-16 pr-6'}`}>
  
  <div className="flex items-center gap-4 relative z-10">
  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm">
  <FontAwesomeIcon icon={faBuilding} className="text-base" />
  </div>
  <div className="flex flex-col">
  <p className="text-[9px] text-emerald-650 font-black uppercase tracking-widest flex items-center gap-1.5">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)] animate-pulse"></span>
  Empreendimento Ativo
  </p>
  <h1 className="text-base font-bold text-gray-800 leading-tight flex items-center gap-2 tracking-tight">
  {empreendimentoSelecionado?.nome || 'Nenhum Empreendimento Vinculado'}
  </h1>
  <p className="text-[11px] text-gray-550 font-medium tracking-wide flex items-center gap-2">
  <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-gray-400" />
  Orçamentação BIM {' · '} 
  {modelosSelecionados && modelosSelecionados.length > 0 ? (
    <span className="text-gray-700 font-bold">{modelosSelecionados.length === 1 ? modelosSelecionados[0]?.nome_arquivo : `${modelosSelecionados.length} Modelos 3D Carregados`}</span>
  ) : (
    <span className="text-gray-400">Aguardando definição do modelo...</span>
  )}
  </p>
  </div>
  </div>

  {/* Ações direita do header */}
  <div className="ml-auto flex items-center gap-3 relative z-10">
  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hidden md:flex items-center gap-2.5">
      <FontAwesomeIcon icon={faLayerGroup} className="text-slate-400 text-xs" />
      <div className="flex flex-col">
          <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider">Mapeamentos</span>
          <span className="text-xs font-bold text-slate-700 leading-none mt-0.5">{kpisMaterial?.totalMapeados || 0}</span>
      </div>
  </div>
  <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-655 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all text-xs font-bold flex items-center gap-2 shadow-sm active:scale-95" title="Voltar para a visualização 3D">
  <FontAwesomeIcon icon={faCube} className="text-[10px]" />
  <span>Ver no Modelo 3D</span>
  </button>
  </div>
  </header>

 {/* ══════════════ CORPO ÚNICO ══════════════ */}
 <div className="flex flex-1 overflow-hidden">

 {/* ─── DIREITA (Ocupa 100% agora pq a Sidebar esquerda foi removida): Tabela de Elementos ─── */}
 <main className="flex-1 flex flex-col overflow-hidden">

 {/* ─── TABS: Elementos BIM | Por Material + Busca ─── */}
 {(modelosSelecionados && modelosSelecionados.length > 0) && (
 <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 flex-shrink-0 pt-2">
 <div className="flex gap-2">
 {[
   { v: 'elementos', label: 'Elementos BIM', icon: faCubes }, 
   { v: 'por-material', label: `Orçamentação${kpisMaterial.totalMapeados > 0 ? ` (${kpisMaterial.totalMapeados})` : ''}`, icon: faFileInvoiceDollar },
   { v: 'lado-a-lado', label: 'Tela Dividida', icon: faColumns }
 ]
 .map(tab => (
 <button
 key={tab.v}
 onClick={() => setAbaAtiva(tab.v)}
 className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
 abaAtiva === tab.v
 ? 'border-blue-600 text-blue-700'
 : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
 }`}
 >
 <FontAwesomeIcon icon={tab.icon} className={abaAtiva === tab.v ? 'text-blue-600' : 'text-gray-400'} />
 {tab.label}
 {tab.v === 'por-material' && kpisMaterial.materialComAlerta > 0 && (
 <span className="ml-1.5 bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
 {kpisMaterial.materialComAlerta} <FontAwesomeIcon icon={faExclamationTriangle} />
 </span>
 )}
 </button>
 ))
 }
 </div>

 {/* Controles de Expansão + Busca */}
 <div className="flex items-center gap-2 pb-2">
 <div className="relative">
 <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-2 text-gray-300 text-xs" />
 <input
 type="text"
 value={buscaElemento}
 onChange={e => setBuscaElemento(e.target.value)}
 placeholder="Buscar família, tipo, SINAPI..."
 className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-52 transition-all"
 />
 </div>
 {(abaAtiva === 'elementos' || abaAtiva === 'lado-a-lado') && (
  <>
  <button
    onClick={() => setApenasNaoMapeados(!apenasNaoMapeados)}
    title={apenasNaoMapeados ? "Mostrar todos os elementos" : "Mostrar apenas elementos sem mapeamento de orçamento"}
    className={`p-1.5 px-2.5 text-xs font-bold border rounded-lg transition-all flex items-center gap-1.5 ${
      apenasNaoMapeados 
        ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm hover:bg-amber-100 bg-white' 
        : 'border-gray-200 text-gray-500 hover:bg-gray-50 bg-white'
    }`}
  >
    <FontAwesomeIcon icon={faTriangleExclamation} className={apenasNaoMapeados ? 'text-amber-500 animate-pulse' : 'text-gray-400'} />
    <span>Não Mapeados</span>
  </button>
  <button onClick={expandirTodas} title="Expandir tudo" className="p-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
  <FontAwesomeIcon icon={faExpand} />
  </button>
  <button onClick={recolherTodas} title="Recolher tudo" className="p-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
  <FontAwesomeIcon icon={faCompress} />
  </button>
  </>
 )}
 {(abaAtiva === 'por-material' || abaAtiva === 'lado-a-lado') && (
 <button
 onClick={() => setInsumoAvulsoModalOpen(true)}
 className="flex items-center gap-2 px-3 py-1.5 ml-auto bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded border border-emerald-200 transition-colors shadow-sm"
 title="Adicionar material ou serviço independente (Ex: Topografia, Pedreiro)"
 >
 <FontAwesomeIcon icon={faBoxOpen} />
 Insumo Avulso
 </button>
 )}
 </div>
 </div>
 )}

  {/* Gaveta Colapsável de Filtros Avançados Unificado (Mesmo BimFilterPanel do 3D) */}
  {modelosSelecionados && modelosSelecionados.length > 0 && (abaAtiva === 'elementos' || abaAtiva === 'lado-a-lado') && (
    <div className="bg-white border-b border-gray-200 shrink-0">
      <div 
        className="px-4 py-2 bg-gray-50 flex items-center justify-between cursor-pointer border-b hover:bg-gray-100/80 transition-colors"
        onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
      >
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faFilter} className="text-blue-600 text-xs" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Filtro Avançado do Motor BIM
          </span>
          {elementosFiltradosDb !== null && (
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
              {elementosFiltradosDb.length.toLocaleString('pt-BR')} resultado(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-medium">
            {isDrawerExpanded ? 'Ocultar Painel de Regras' : 'Abrir Painel de Regras'}
          </span>
          <FontAwesomeIcon icon={isDrawerExpanded ? faChevronUp : faChevronDown} className="text-gray-400 text-xs" />
        </div>
      </div>

      {isDrawerExpanded && (
        <div className="max-h-[350px] overflow-y-auto bg-gray-50/50">
          <BimFilterPanel 
            viewer={viewer}
            projetoBimId={modelosSelecionadosIds[0]}
            loadedProjectIds={modelosSelecionadosIds}
            onFilterApplied={(data) => setElementosFiltradosDb(data)}
            onFilterCleared={() => setElementosFiltradosDb(null)}
          />
        </div>
      )}
    </div>
  )}

  {/* Banner Informativo de Prova Visual de Filtro Ativo do Motor BIM */}
  {elementosFiltradosDb !== null && (abaAtiva === 'elementos' || abaAtiva === 'lado-a-lado') && (
    <div className="bg-blue-50/90 border-b border-blue-200 px-5 py-2 text-xs text-blue-900 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
        <span className="font-bold flex items-center gap-2">
          <FontAwesomeIcon icon={faFilter} className="text-blue-600" />
          <span>
            Filtro do Motor BIM Ativo: <strong>{elementosFiltradosDb.length.toLocaleString('pt-BR')}</strong> instância(s) correspondente(s) encontrada(s) no modelo 3D
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold text-blue-800 bg-blue-100/90 px-2.5 py-1 rounded-full border border-blue-300 shadow-xs">
          {gruposFiltrados.length} categoria(s) no resultado
        </span>
        <button
          onClick={() => {
            setRegrasFiltro([]);
            setCategoriaFiltro('');
          }}
          className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
        >
          Limpar Filtro
        </button>
      </div>
    </div>
  )}

 {/* Tabela de Elementos */}
 <div className={`flex-1 ${abaAtiva === 'lado-a-lado' ? 'grid grid-cols-2 divide-x divide-gray-200 overflow-hidden bg-white' : 'overflow-y-auto'}`}>
 {/* ─── ABA: POR MATERIAL ─── */}
 {(abaAtiva === 'por-material' || abaAtiva === 'lado-a-lado') && (
 <div className={abaAtiva === 'lado-a-lado' ? "order-2 h-full overflow-y-auto p-5" : "p-5"}>
 {(!modelosSelecionadosIds || modelosSelecionadosIds.length === 0) ? (
 <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
 <FontAwesomeIcon icon={faCubes} className="text-5xl text-gray-200" />
 <p className="font-semibold text-center">Selecione modelos BIM à esquerda para visualizar o orçamento.</p>
 </div>
 ) : quantitativoPorMaterial.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
 <span className="text-5xl text-gray-300"><FontAwesomeIcon icon={faBoxOpen} /></span>
 <p className="font-semibold text-center">
 Nenhum material vinculado ainda.<br />
 <span className="text-xs">Abra um elemento no sidebar e clique e clique em &quot;<FontAwesomeIcon icon={faLink} className="mx-1" /> vincular&quot; numa propriedade.</span>
 </p>
 </div>
 ) : (
 <>
 {/* Banner: escopo de orçamentação selecionado */}
 <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
 {carregandoQuantitativoPorMaterial ? (
 <>
 <FontAwesomeIcon icon={faSpinner} spin className="text-blue-400 text-xs" />
 <span>Calculando quantitativos dos modelos selecionados...</span>
 </>
 ) : (
  <>
  <FontAwesomeIcon icon={faBuilding} className="mr-1" />
  <span>
  <strong>{empreendimentoSelecionado?.nome}</strong>
  {' · '}{modelosSelecionados.length} modelo{modelosSelecionados.length !== 1 ? 's' : ''} selecionado{modelosSelecionados.length !== 1 ? 's' : ''}
  {' · '}<strong>{kpis.totalElementos.toLocaleString('pt-BR')}</strong> elementos no escopo
  </span>
  </>
 )}
 </div>

  {/* KPIs materiais */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    {/* Card Custo Estimado */}
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden flex items-center gap-4">
      <div className="w-1.5 h-full bg-emerald-500 absolute left-0 top-0"></div>
      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <FontAwesomeIcon icon={faDollarSign} className="text-sm" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Custo Estimado</p>
        <p className="text-base font-bold text-gray-800 mt-0.5">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpisMaterial.custoTotal)}
        </p>
      </div>
    </div>

    {/* Card Materiais Mapeados */}
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden flex items-center gap-4">
      <div className="w-1.5 h-full bg-blue-500 absolute left-0 top-0"></div>
      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
        <FontAwesomeIcon icon={faCheck} className="text-sm" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Materiais Mapeados</p>
        <p className="text-base font-bold text-gray-800 mt-0.5">{kpisMaterial.totalMapeados}</p>
      </div>
    </div>

    {/* Card Alertas de Sync */}
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden flex items-center gap-4">
      <div className="w-1.5 h-full bg-amber-500 absolute left-0 top-0"></div>
      <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-sm" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alertas de Sync</p>
        <p className="text-base font-bold text-gray-800 mt-0.5">{kpisMaterial.materialComAlerta}</p>
      </div>
    </div>
  </div>

  {/* Alternador de Visualização do Orçamento */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
    <div className="bg-gray-100 p-1 rounded-xl inline-flex items-center gap-1 border border-gray-200/80 shadow-sm">
      <button
        onClick={() => setTipoVisualizacao('etapa')}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          tipoVisualizacao === 'etapa'
            ? 'bg-black text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
        }`}
      >
        <FontAwesomeIcon icon={faLayerGroup} />
        Por Etapa / Subetapa
      </button>
      <button
        onClick={() => setTipoVisualizacao('categoria')}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          tipoVisualizacao === 'categoria'
            ? 'bg-black text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
        }`}
      >
        <FontAwesomeIcon icon={faCubes} />
        Por Categoria Revit
      </button>
      <button
        onClick={() => setTipoVisualizacao('material')}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          tipoVisualizacao === 'material'
            ? 'bg-black text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
        }`}
      >
        <FontAwesomeIcon icon={faBarcode} />
        Por Material Consolidado
      </button>
    </div>
    
    <div className="text-[11px] text-gray-555 font-semibold bg-gray-50/75 px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm">
      {tipoVisualizacao === 'etapa' && 'Visualização em árvore agrupada por etapa e subetapa do cronograma.'}
      {tipoVisualizacao === 'categoria' && 'Visualização agrupada pelas categorias do modelo 3D (Eberick/Revit).'}
      {tipoVisualizacao === 'material' && 'Visualização consolidada com a soma total de cada material no projeto.'}
    </div>
  </div>

  {/* Tabela de quantitativos por material */}
  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
  <table className="w-full text-sm border-collapse">
  <thead className="bg-gray-50/75 border-b border-gray-200">
  <tr>
  {/* Checkbox Geral de Selecionar Todos */}
  <th className="px-4 py-3 text-center w-10">
    <input
      type="checkbox"
      checked={todosSelecionados}
      onChange={handleToggleSelecionarTodos}
      className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
      title="Selecionar todos os materiais visíveis nesta aba"
    />
  </th>
  <th className="px-6 py-3 text-left">
    {renderHeaderOrdenavel('nome', 'Material')}
  </th>
  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Unid.</th>
  <th className="px-6 py-3 text-right">
    <div className="flex justify-end w-full">
      {renderHeaderOrdenavel('quantidade', 'Quantidade')}
    </div>
  </th>
  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Entregue</th>
  <th className="px-6 py-3 text-right">
    <div className="flex justify-end w-full">
      {renderHeaderOrdenavel('preco', 'R$ Unit.')}
    </div>
  </th>
  <th className="px-6 py-3 text-right">
    <div className="flex justify-end w-full">
      {renderHeaderOrdenavel('custo', 'Total Est.')}
    </div>
  </th>
  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Elem.</th>
  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Ações</th>
  </tr>
  </thead>
  <tbody>
    {/* 1. VISÃO POR ETAPA / SUBETAPA */}
    {tipoVisualizacao === 'etapa' && quantitativosAgrupados.map(grupo => {
      const isExpandido = !etapasRecolhidas.has(grupo.etapa_id);
      return (
        <Fragment key={grupo.etapa_id}>
          {/* L1: Cabeçalho da Etapa */}
          <tr className="bg-blue-50 border-t-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => toggleEtapaOrcamento(grupo.etapa_id)}
          >
            {/* Incrementado colSpan de 5 para 6 devido à nova coluna Entregue */}
            <td colSpan={6} className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={isExpandido ? faAngleDown : faAngleRight} className="text-blue-500 w-3" />
                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                  {grupo.etapa_nome}
                </h3>
                {grupo.tem_alertas && <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 ml-2" title="Possui itens com alertas/removidos" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const ids = (grupo.subetapasLista || []).flatMap(s => s.materiais.flatMap(m => m.external_ids_ativos));
                    handleShowInModel(ids, grupo.etapa_nome);
                  }}
                  className="ml-3 text-[9px] bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white px-2 py-0.5 rounded-full font-bold transition-colors shadow-sm"
                  title="Ver todos elementos desta etapa no modelo 3D"
                >
                  <FontAwesomeIcon icon={faCubes} className="mr-1" /> 3D
                </button>
              </div>
            </td>
            <td className="px-4 py-2.5 text-right font-extrabold text-blue-800">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grupo.custo_total)}
            </td>
            <td colSpan={2}></td>
          </tr>

          {/* L2: Subetapas e Materiais */}
          {isExpandido && (grupo.subetapasLista || []).map(sub => (
            <Fragment key={sub.subetapa_id}>
              {/* Cabeçalho Subetapa (se houver nome) */}
              {sub.subetapa_nome && (
                <tr className="bg-gray-100 border-t border-gray-200">
                  {/* Incrementado colSpan de 5 para 6 devido à nova coluna Entregue */}
                  <td colSpan={6} className="px-8 py-2">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <FontAwesomeIcon icon={faLayerGroup} className="text-gray-400" />
                      {sub.subetapa_nome}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const ids = sub.materiais.flatMap(m => m.external_ids_ativos);
                          handleShowInModel(ids, sub.subetapa_nome);
                        }}
                        className="ml-2 text-[9px] text-gray-400 hover:text-blue-600 border border-transparent hover:border-blue-200 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-all"
                        title="Ver elementos desta subetapa no modelo 3D"
                      >
                        <FontAwesomeIcon icon={faCubes} />
                      </button>
                    </h4>
                  </td>
                  <td className="px-4 py-2 text-right text-[10px] font-bold text-gray-500">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.custo_total)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}

              {/* Itens Materiais */}
              {sub.materiais.map(item => renderMaterialRow(item, "pl-12"))}
            </Fragment>
          ))}
        </Fragment>
      );
    })}

    {/* 2. VISÃO POR CATEGORIA REVIT */}
    {tipoVisualizacao === 'categoria' && (
      carregandoQuantitativoPorCategoria ? (
        <tr>
          <td colSpan={9} className="px-4 py-20 text-center">
            <div className="flex flex-col items-center justify-center text-blue-600 font-bold gap-3 animate-pulse">
              <FontAwesomeIcon icon={faSpinner} spin className="text-2xl" />
              <span className="text-xs">Calculando custos por categoria do Revit...</span>
            </div>
          </td>
        </tr>
      ) : quantitativosPorCategoria.map(grupo => {
        const isExpandido = !etapasRecolhidas.has(grupo.categoria_nome);
        return (
          <Fragment key={grupo.categoria_nome}>
            {/* L1: Cabeçalho da Categoria */}
            <tr className="bg-blue-50 border-t-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => toggleEtapaOrcamento(grupo.categoria_nome)}
            >
              {/* Incrementado colSpan de 5 para 6 devido à nova coluna Entregue */}
              <td colSpan={6} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={isExpandido ? faAngleDown : faAngleRight} className="text-blue-500 w-3" />
                  <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                    {grupo.categoria_nome}
                  </h3>
                  {grupo.tem_alertas && <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 ml-2" title="Possui itens com alertas/removidos" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ids = grupo.materiais.flatMap(m => m.external_ids_ativos);
                      handleShowInModel(ids, grupo.categoria_nome);
                    }}
                    className="ml-3 text-[9px] bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white px-2 py-0.5 rounded-full font-bold transition-colors shadow-sm"
                    title="Ver todos elementos desta categoria no modelo 3D"
                  >
                    <FontAwesomeIcon icon={faCubes} className="mr-1" /> 3D
                  </button>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right font-extrabold text-blue-800">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grupo.custo_total)}
              </td>
              <td colSpan={2}></td>
            </tr>

            {/* L2: Materiais da Categoria */}
            {isExpandido && grupo.materiais.map(item => renderMaterialRow(item, "pl-8"))}
          </Fragment>
        );
      })
    )}

    {/* 3. VISÃO POR MATERIAL CONSOLIDADO */}
    {tipoVisualizacao === 'material' && quantitativosPorMaterialConsolidado.map(item => renderMaterialRow(item, "pl-8"))}
  </tbody>
  {quantitativoPorMaterial.some(m => m.preco_unitario > 0) && (
  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
  <tr>
  {/* Incrementado colSpan de 5 para 6 devido à nova coluna Entregue */}
  <td colSpan={6} className="px-4 py-2.5 text-xs font-extrabold text-gray-650 uppercase tracking-wide">Total Estimado</td>
  <td className="px-4 py-2.5 text-right font-extrabold text-emerald-700">
  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpisMaterial.custoTotal)}
  </td>
  <td colSpan={2}></td>
  </tr>
  </tfoot>
  )}
  </table>
  </div>
  </>
 )}
 </div>
 )}

 {/* ─── ABA: ELEMENTOS BIM (original) ─── */}
 {((abaAtiva === 'elementos' || abaAtiva === 'lado-a-lado') || !modelosSelecionadosIds || modelosSelecionadosIds.length === 0) && (
 <div className={abaAtiva === 'lado-a-lado' ? "order-1 h-full overflow-y-auto p-5" : ""}>
 {carregandoElementos ? (
  <div className="flex flex-col items-center justify-center h-full text-blue-400 gap-3">
  <FontAwesomeIcon icon={faSpinner} spin size="2x" />
  <p className="text-sm text-gray-500">Carregando elementos BIM...</p>
  </div>
 ) : (!modelosSelecionadosIds || modelosSelecionadosIds.length === 0) ? (
  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
  <FontAwesomeIcon icon={faCubes} className="text-5xl text-gray-200" />
  <p className="font-semibold">Selecione um modelo BIM à esquerda para visualizar os elementos.</p>
  </div>
 ) : gruposFiltrados.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
  <FontAwesomeIcon icon={faBoxOpen} className="text-5xl text-gray-200" />
  <p className="font-semibold">Nenhum elemento encontrado{buscaElemento ? ' para a busca realizada' : ' neste modelo'}.</p>
  </div>
 ) : (
  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
   <table className="w-full text-sm border-collapse">
   <thead className="bg-gray-50/75 border-b border-gray-200 sticky top-0 z-10">
   <tr>
   <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-10"></th>
   <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Família / Tipo / Categoria</th>
   <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Quantidade</th>
   <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-36">SINAPI Revit</th>
   <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Ações</th>
   </tr>
   </thead>
   <tbody>
   {gruposFiltrados.map(cat => {
   const catExpandida = categoriasExpandidas.has(cat.categoria);
   const mapeamentoCat = mapeamentos.find(m =>
     m.escopo === 'categoria' &&
     m.categoria_bim === cat.categoria
   );
   const elementosCat = todosElementos.filter(el => el.categoria === cat.categoria);
   const propriedadesCat = extrairPropriedadesAcumuladas(elementosCat);

   return (
   <Fragment key={`frag-cat-${cat.categoria}`}>
   {/* ── L1: Categoria ── */}
   <tr
     key={`cat-${cat.categoria}`}
     onClick={() => {
       carregarFamiliasDaCategoria(cat.categoria);
       toggleCategoria(cat.categoria);
     }}
     className={`bg-gray-200 cursor-pointer hover:bg-gray-300 transition-all duration-1000 border-t-2 border-gray-300 group ${
       linhaDestacadaChave === `cat-${cat.categoria}` 
         ? 'bg-emerald-100/80 transition-none' 
         : ''
     }`}
   >
   <td className="px-3 py-2.5 text-center">
   <FontAwesomeIcon icon={catExpandida ? faAngleDown : faAngleRight} className="text-gray-500" />
   </td>
   <td className="px-4 py-2.5 font-bold text-gray-700 text-xs uppercase tracking-wide">
   <FontAwesomeIcon icon={faLayerGroup} className="mr-2 text-blue-500" />
   {cat.categoria}
   </td>
   <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-600">
   {cat.total_elementos.toLocaleString('pt-BR')} elem.
   </td>
   <td className="px-4 py-2.5 text-left">
   {mapeamentoCat ? (
     mapeamentoCat.sinapi_id ? (
       <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 font-mono">
         {mapeamentoCat.sinapi?.["Código da Composição"] || 'SINAPI'}
       </span>
     ) : (
       <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100 font-mono">
         Próprio
       </span>
     )
   ) : (
     <span className="text-gray-300 text-[10px] font-normal">—</span>
   )}
   </td>
   <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
     <div className="flex items-center justify-center gap-1.5">
       <button
         onClick={() => selecionarCategoriaNo3D(cat, false)}
         className="w-7 h-7 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-all"
         title="Visualizar Categoria no 3D"
       >
         <FontAwesomeIcon icon={faCubes} className="text-xs" />
       </button>
       {mapeamentoCat ? (
         <button
           onClick={(e) => {
             e.stopPropagation();
             selecionarCategoriaNo3D(cat, true);
             setMaterialGerenciar({
               material_id: mapeamentoCat.material_id,
               sinapi_id: mapeamentoCat.sinapi_id,
               origem: mapeamentoCat.material_id ? 'proprio' : 'sinapi',
               nome: mapeamentoCat.material?.nome || mapeamentoCat.sinapi?.descricao || 'Material Vinculado'
             });
           }}
           className="w-7 h-7 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-all"
           title="Gerenciar Vínculo da Categoria"
         >
           <FontAwesomeIcon icon={faLink} className="text-xs" />
         </button>
       ) : (
         <button
           onClick={(e) => {
             e.stopPropagation();
             selecionarCategoriaNo3D(cat, true);
             setVinculoModal({
               propriedade: { nome: '', valor: 0, unidade: 'un' },
               elemento: {
                 categoria: cat.categoria,
                 familia: null,
                 tipo: null,
                 total_elementos: cat.total_elementos
               }
             });
           }}
           className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100"
           title="Vincular Categoria a Material"
         >
           <FontAwesomeIcon icon={faLink} className="text-xs" />
         </button>
       )}
     </div>
   </td>
   </tr>
  
   {catExpandida && cat.carregandoFamilias && (
      <tr key={`loading-cat-${cat.categoria}`} className="bg-gray-50/50">
        <td className="px-3 py-3 text-center pl-10" colSpan={5}>
          <div className="flex items-center gap-2 text-xs text-blue-600 font-black animate-pulse">
            <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
            <span>Buscando famílias da categoria no banco de dados...</span>
          </div>
        </td>
      </tr>
   )}
  
   {catExpandida && !cat.carregandoFamilias && cat.familias.length === 0 && (
      <tr key={`empty-cat-${cat.categoria}`} className="bg-gray-50/30">
        <td className="px-3 py-3 text-center pl-10 text-xs text-gray-400 font-semibold italic" colSpan={5}>
          Nenhuma família encontrada para esta categoria.
        </td>
      </tr>
   )}
  
   {catExpandida && !cat.carregandoFamilias && cat.familias.map(fam => {
   const famChave = `${cat.categoria}|||${fam.familia}`;
   const famExpandida = familiasExpandidas.has(famChave);
   const mapeamentoFam = mapeamentos.find(m =>
     m.escopo === 'familia' &&
     m.categoria_bim === cat.categoria &&
     m.familia_bim === fam.familia
   );
   const elementosFam = todosElementos.filter(el => el.categoria === cat.categoria && el.familia === fam.familia);
   const propriedadesFam = extrairPropriedadesAcumuladas(elementosFam);

   return (
   <Fragment key={`frag-fam-${famChave}`}>
   {/* ── L2: Família ── */}
   <tr
   key={`fam-${famChave}`}
   className={`bg-blue-50 cursor-pointer hover:bg-blue-100 transition-all duration-1000 border-t border-blue-100 group ${
     linhaDestacadaChave === `fam-${famChave}` 
       ? 'bg-emerald-100/80 transition-none' 
       : ''
   }`}
   >
   <td
   className="px-3 py-2 text-center pl-7"
   onClick={() => toggleFamiliaExpandida(famChave)}
   >
   <FontAwesomeIcon icon={famExpandida ? faAngleDown : faAngleRight} className="text-blue-400 text-xs" />
   </td>
   <td
   className="px-4 py-2 font-semibold text-blue-800 text-xs"
   onClick={() => toggleFamiliaExpandida(famChave)}
   >
   {fam.familia}
   <span className="ml-2 text-[10px] text-blue-400 font-normal">
   {fam.tipos.length} tipo{fam.tipos.length !== 1 ? 's' : ''}
   </span>
   </td>
   <td
   className="px-4 py-2 text-right text-xs font-bold text-blue-600"
   onClick={() => toggleFamiliaExpandida(famChave)}
   >
   {fam.total_elementos.toLocaleString('pt-BR')} elem.
   </td>
   <td className="px-4 py-2 text-left">
   {mapeamentoFam ? (
     mapeamentoFam.sinapi_id ? (
       <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 font-mono">
         {mapeamentoFam.sinapi?.["Código da Composição"] || 'SINAPI'}
       </span>
     ) : (
       <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100 font-mono">
         Próprio
       </span>
     )
   ) : (
     <span className="text-gray-300 text-[10px] font-normal">—</span>
   )}
   </td>
   <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
     <div className="flex items-center justify-center gap-1.5">
       <button
         onClick={() => selecionarFamiliaNo3D(cat, fam, false)}
         className="w-7 h-7 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-all"
         title="Visualizar Família no 3D"
       >
         <FontAwesomeIcon icon={faCubes} className="text-xs" />
       </button>
       {mapeamentoFam ? (
         <button
           onClick={(e) => {
             e.stopPropagation();
             selecionarFamiliaNo3D(cat, fam, true);
             setMaterialGerenciar({
               material_id: mapeamentoFam.material_id,
               sinapi_id: mapeamentoFam.sinapi_id,
               origem: mapeamentoFam.material_id ? 'proprio' : 'sinapi',
               nome: mapeamentoFam.material?.nome || mapeamentoFam.sinapi?.descricao || 'Material Vinculado'
             });
           }}
           className="w-7 h-7 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-all"
           title="Gerenciar Vínculo da Família"
         >
           <FontAwesomeIcon icon={faLink} className="text-xs" />
         </button>
       ) : (
         <button
           onClick={(e) => {
             e.stopPropagation();
             selecionarFamiliaNo3D(cat, fam, true);
             setVinculoModal({
               propriedade: { nome: '', valor: 0, unidade: 'un' },
               elemento: {
                 categoria: cat.categoria,
                 familia: fam.familia,
                 tipo: null,
                 total_elementos: fam.total_elementos
               }
             });
           }}
           className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100"
           title="Vincular Família a Material"
         >
           <FontAwesomeIcon icon={faLink} className="text-xs" />
         </button>
       )}
     </div>
   </td>
   </tr>
  
   {famExpandida && fam.carregando && (
   <tr key={`loading-fam-${famChave}`} className="bg-gray-50/20">
   <td className="px-3 py-3.5 text-center pl-12" colSpan={5}>
   <div className="flex items-center gap-2 text-xs text-blue-600 font-black animate-pulse">
   <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
   <span>Buscando tipos e medidas no banco de dados...</span>
   </div>
   </td>
   </tr>
   )}
  
   {famExpandida && !fam.carregando && fam.tipos.map((t, idx) => {
   const tChave = tipoChave(cat.categoria, fam.familia, t.tipo);
   const tExpandido = tiposExpandidos.has(tChave);
   const medidaAtiva = getMedidaAtiva(cat.categoria, fam.familia, t);
   const temMultiplas = t.medidas.length > 1;
   const propriedadesTipo = extrairPropriedadesAcumuladas(t.elementos || []);
  
   // Extrair descrição do primeiro elemento do tipo
   const primeiroEl = t.elementos[0]?.propriedades || {};
   const descricaoTipo = primeiroEl['Descrição'] || primeiroEl['Description'] || primeiroEl['Comentários de tipo'] || primeiroEl['Type Comments'] || '—';
   const mapeamentoTipo = mapeamentos.find(m => 
     m.escopo === 'tipo' && 
     m.categoria_bim === cat.categoria && 
     m.familia_bim === fam.familia && 
     m.tipo_bim === t.tipo
   );

   return (
   <Fragment key={`frag-t-${tChave}`}>
   {/* ── L3: Tipo ── */}
   <tr
   key={`tipo-${tChave}`}
   className={`border-b border-gray-100 group transition-all duration-1000 ${
     linhaDestacadaChave === tChave 
       ? 'bg-emerald-100/80 transition-none' 
       : 'hover:bg-blue-50/30'
   }`}
   >
   <td className="px-3 py-2 text-center pl-12">
   <button
   onClick={() => toggleTipoExpandido(tChave)}
   className="w-5 h-5 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-all flex items-center justify-center mx-auto"
   title="Expandir elementos individuais"
   >
   <FontAwesomeIcon icon={tExpandido ? faAngleDown : faAngleRight} className="text-xs" />
   </button>
   </td>
   {/* Nome do tipo — clica apenas para expandir */}
   <td
   className="px-4 py-2 text-xs text-gray-700 cursor-pointer hover:text-blue-700 font-medium"
   onClick={() => toggleTipoExpandido(tChave)}
   >
   <div>
     <div className="font-semibold">{t.tipo === '(sem tipo)' ? <em className="text-gray-400">sem tipo</em> : t.tipo}</div>
     {descricaoTipo !== '—' && <div className="text-[9px] text-gray-400 max-w-[400px] truncate" title={descricaoTipo}>{descricaoTipo}</div>}
   </div>
   </td>
   {/* Unidade + Quantidade condensados */}
   <td className="px-4 py-2 text-right">
     <div className="flex flex-col items-end justify-center">
       <span className="text-xs font-bold text-gray-800">
         {medidaAtiva ? fmt2(medidaAtiva.valor) : t.qtd_total}
       </span>
       <div className="mt-1">
         {t.medidas.length === 0 ? (
           <BadgeUnidade unidade="un" />
         ) : temMultiplas ? (
           <div className="flex justify-end gap-1 flex-wrap max-w-[150px]">
             {t.medidas.map(m => (
               <BadgeUnidade
                 key={m.chave}
                 unidade={m.unidade}
                 ativo={medidaAtiva?.chave === m.chave}
                 onClick={(e) => {
                   e.stopPropagation();
                   setMedidasSelecionadas(prev => ({ ...prev, [tChave]: m.chave }));
                 }}
               />
             ))}
           </div>
         ) : (
           <BadgeUnidade unidade={medidaAtiva?.unidade || 'un'} />
         )}
       </div>
     </div>
   </td>
   <td className="px-4 py-2 text-left">
     {t.sinapi_revit ? (
       <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 font-mono">
         {t.sinapi_revit}
       </span>
     ) : mapeamentoTipo ? (
       mapeamentoTipo.sinapi_id ? (
         <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 font-mono">
           {mapeamentoTipo.sinapi?.["Código da Composição"] || 'SINAPI'}
         </span>
       ) : (
         <span className="bg-emerald-55 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100 font-mono">
           Próprio
         </span>
       )
     ) : (
       <span className="text-gray-200 text-[10px]">—</span>
     )}
   </td>
   <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
     <div className="flex items-center justify-center gap-1.5">
       <button
         onClick={() => selecionarTipoNo3D(cat, fam, t, false)}
         className="w-7 h-7 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-all"
         title="Visualizar Tipo no 3D"
       >
         <FontAwesomeIcon icon={faCubes} className="text-xs" />
       </button>
       {mapeamentoTipo ? (
         <button
           onClick={(e) => {
             e.stopPropagation();
             selecionarTipoNo3D(cat, fam, t, true);
             setMaterialGerenciar({
               material_id: mapeamentoTipo.material_id,
               sinapi_id: mapeamentoTipo.sinapi_id,
               origem: mapeamentoTipo.material_id ? 'proprio' : 'sinapi',
               nome: mapeamentoTipo.material?.nome || mapeamentoTipo.sinapi?.descricao || 'Material Vinculado'
             });
           }}
           className="w-7 h-7 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-all"
           title="Gerenciar Vínculo do Tipo"
         >
           <FontAwesomeIcon icon={faLink} className="text-xs" />
         </button>
       ) : (
         <button
           onClick={(e) => {
             e.stopPropagation();
             selecionarTipoNo3D(cat, fam, t, true);
             setVinculoModal({
               propriedade: { nome: '', valor: 0, unidade: 'un' },
               elemento: {
                 categoria: cat.categoria,
                 familia: fam.familia,
                 tipo: t.tipo,
                 total_elementos: t.qtd_total
               }
             });
           }}
           className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100"
           title="Vincular Tipo a Material"
         >
           <FontAwesomeIcon icon={faLink} className="text-xs" />
         </button>
       )}
     </div>
   </td>
   </tr>
  
   {/* ── L4: Elementos individuais ── */}
   {tExpandido && t.elementos.map(el => {
   const props = el.propriedades || {};
   const valorEl = medidaAtiva ? parseFloat(props[medidaAtiva.chave] || 0) : null;
   const mapeamentoEl = mapeamentos.find(m => 
     m.escopo === 'elemento' && 
     String(m.elemento_id) === String(el.external_id)
   );

   return (
   <tr 
     key={`el-${el.id}`} 
     onClick={() => {
       setInspecaoModal({
         elemento: {
           id: el.id,
           external_id: el.external_id,
           categoria: cat.categoria,
           familia: fam.familia,
           tipo: t.tipo,
           propriedades: el.propriedades
         }
       });
     }}
     className={`border-b border-gray-55 cursor-pointer transition-colors duration-1000 ${
       linhaDestacadaChave === `el-${el.id}` 
         ? 'bg-emerald-100/80 transition-none' 
         : 'bg-amber-50/20 hover:bg-amber-50/60'
     }`}
   >
   <td className="px-3 py-1.5 pl-16 text-amber-300 text-center">
   <FontAwesomeIcon icon={faAngleRight} className="text-[10px] opacity-25" />
   </td>
   <td className="px-4 py-1.5 text-[10px] text-gray-555">
   Nome: <span className="font-mono text-gray-655">{props['Name'] || props['Nome'] || props['Mark'] || props['Marca'] || 'Instância'}</span>
   </td>
   <td className="px-4 py-1.5 text-right text-[10px] text-gray-655 font-medium">
   <div className="flex items-center justify-end gap-1.5">
     <span>{valorEl && valorEl > 0 ? fmt2(valorEl) : '1'}</span>
     <BadgeUnidade unidade={medidaAtiva?.unidade || 'un'} />
   </div>
   </td>
   <td className="px-4 py-1.5 text-left">
     {mapeamentoEl ? (
       mapeamentoEl.sinapi_id ? (
         <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-100 font-mono">
           {mapeamentoEl.sinapi?.["Código da Composição"] || 'SINAPI'}
         </span>
       ) : (
         <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 font-mono">
           Próprio
         </span>
       )
     ) : props['SINAPI'] ? (
       <span className="text-[9px] font-mono text-indigo-450">{props['SINAPI']}</span>
     ) : (
       <span className="text-gray-255 text-[9px]">—</span>
     )}
   </td>
   <td className="px-4 py-1.5 text-center text-[10px]" onClick={(e) => e.stopPropagation()}>
     <div className="flex items-center justify-center gap-1.5">
       <button
         onClick={() => handleShowInModel([el.external_id], props['Name'] || props['Nome'] || 'Instância', false)}
         className="w-6 h-6 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-all"
         title="Visualizar Instância no 3D"
       >
         <FontAwesomeIcon icon={faCubes} className="text-[9px]" />
       </button>
       {mapeamentoEl ? (
         <button
           onClick={(e) => {
             e.stopPropagation();
             setMaterialGerenciar({
               material_id: mapeamentoEl.material_id,
               sinapi_id: mapeamentoEl.sinapi_id,
               origem: mapeamentoEl.material_id ? 'proprio' : 'sinapi',
               nome: mapeamentoEl.material?.nome || mapeamentoEl.sinapi?.descricao || 'Material Vinculado'
             });
           }}
           className="w-6 h-6 rounded-full text-emerald-600 bg-emerald-55 hover:bg-emerald-100 flex items-center justify-center transition-all"
           title="Gerenciar Vínculo da Instância"
         >
           <FontAwesomeIcon icon={faLink} className="text-[10px]" />
         </button>
       ) : (
         <button
           onClick={(e) => {
             e.stopPropagation();
             setInspecaoModal({
               elemento: {
                 id: el.id,
                 external_id: el.external_id,
                 categoria: cat.categoria,
                 familia: fam.familia,
                 tipo: t.tipo,
                 propriedades: el.propriedades
               }
             });
           }}
           className="w-6 h-6 rounded-full flex items-center justify-center transition-all text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100"
           title="Visualizar Propriedades da Instância"
         >
           <FontAwesomeIcon icon={faLink} className="text-[10px]" />
         </button>
       )}
     </div>
   </td>
    </tr>
   );
   })}
   </Fragment>
   );
   })}
   </Fragment>
   );
   })}
   </Fragment>
   );
   })}
   </tbody>
   </table>
 </div>
 )}
 </div>
 )}
 </div>
 </main>
 </div>

  {/* ─── MODAL: Vincular Propriedade BIM ao Material (Simplificado para Categoria/Família/Tipo, Completo para Instância/Elemento) ─── */}
  {vinculoModal && (
    vinculoModal.elemento?.propriedades ? (
      <BimVinculoMaterialModal
        isOpen={!!vinculoModal}
        onClose={() => setVinculoModal(null)}
        elemento={vinculoModal.elemento}
        todosElementos={todosElementos}
        organizacaoId={organizacao_id}
        onSalvar={handleSalvarMapeamento}
        onExcluir={handleExcluirMapeamento}
        mapeamentoExistente={resolverMapeamento(vinculoModal.elemento, vinculoModal.propriedade?.nome)}
        mapeamentos={mapeamentos}
        propriedadeInicialNome={vinculoModal.propriedade?.nome}
      />
    ) : (
      <BimVinculoSimplificadoModal
        isOpen={!!vinculoModal}
        onClose={() => setVinculoModal(null)}
        elemento={vinculoModal.elemento}
        todosElementos={todosElementos}
        organizacaoId={organizacao_id}
        onSalvar={handleSalvarMapeamento}
        onExcluir={handleExcluirMapeamento}
        mapeamentoExistente={resolverMapeamento(
          vinculoModal.elemento, 
          `[ELEMENTO] ${vinculoModal.elemento?.tipo || vinculoModal.elemento?.familia || vinculoModal.elemento?.categoria}`
        )}
      />
    )
  )}

  {/* ─── MODAL: Inspecionar Propriedades da Instância (Nível L4) ─── */}
  {inspecaoModal && (
    <BimElementPropertiesModal
      isOpen={!!inspecaoModal}
      onClose={() => setInspecaoModal(null)}
      elemento={inspecaoModal.elemento}
      propriedadesMapeadas={propriedadesMapeadas}
      resolverMapeamento={resolverMapeamento}
      onVincularPropriedade={(propNome, propValor) => 
        handleVincularPropriedadeDeElemento(propNome, propValor, inspecaoModal.elemento)
      }
      onDesvincularPropriedade={handleExcluirMapeamento}
    />
  )}

 {/* ─── MODAL: Gerenciar/Desvincular Regras do Material ─── */}
 <BimGerenciarVinculosModal
 isOpen={!!materialGerenciar}
 onClose={() => setMaterialGerenciar(null)}
 materialOuSinapi={materialGerenciar}
 mapeamentos={mapeamentos}
 onExcluir={handleExcluirMapeamento}
 organizacaoId={organizacao_id}
 />

 {/* ─── MODAL BIM IMPORT ─── */}
 {isBimModalAberto && (
 <BimImportModal
 isOpen={isBimModalAberto}
 onClose={() => setIsBimModalAberto(false)}
 empreendimentoId={empreendimentoSelecionadoId}
 orcamentoId={null}
 organizacaoId={organizacao_id}
 etapas={etapas}
 />
 )}

 {/* ─── MODAL: INSUMO AVULSO ─── */}
 {insumoAvulsoModalOpen && (
 <BimInsumoAvulsoModal
 isOpen={insumoAvulsoModalOpen}
 onClose={() => setInsumoAvulsoModalOpen(false)}
 empreendimentoId={empreendimentoSelecionadoId}
 organizacaoId={organizacao_id}
 />
 )}

  {/* Barra de Ação Flutuante para solicitar compras */}
  {Object.keys(itensSelecionados).length > 0 && (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl border border-gray-800 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 text-xs">
        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center font-bold text-[10px]">
          {Object.keys(itensSelecionados).length}
        </div>
        <span className="font-semibold text-gray-300">
          {Object.keys(itensSelecionados).length === 1 ? "material selecionado" : "materiais selecionados"}
        </span>
      </div>
      <div className="h-4 w-px bg-gray-700" />
      <div className="flex gap-2">
        <button
          onClick={() => setItensSelecionados({})}
          className="text-xs font-bold text-gray-400 hover:text-white transition-colors px-3 py-1"
        >
          Limpar
        </button>
        <button
          onClick={() => setIsSolicitarCompraModalAberto(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow active:scale-95"
        >
          <FontAwesomeIcon icon={faShoppingCart} className="text-[10px]" />
          Solicitar Compra
        </button>
      </div>
    </div>
  )}

  {/* ─── MODAL: SOLICITAR COMPRA ─── */}
  {isSolicitarCompraModalAberto && (
    <BimSolicitarCompraModal
      isOpen={isSolicitarCompraModalAberto}
      onClose={() => setIsSolicitarCompraModalAberto(false)}
      itensSelecionados={Object.values(itensSelecionados)}
      empreendimento={empreendimentoSelecionado}
      organizacaoId={organizacao_id}
      usuarioId={user?.id}
      onSucesso={() => {
        setItensSelecionados({});
      }}
    />
  )}
 </div>
 );
}
