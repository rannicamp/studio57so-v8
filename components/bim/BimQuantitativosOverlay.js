'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faCubes, faChevronDown, faChevronRight, faSpinner, faHome,
 faBuilding, faCheck, faLayerGroup, faRuler, faRulerCombined,
 faFileExport, faArrowRight, faAngleDown, faAngleRight,
 faTriangleExclamation, faBoxOpen, faExpand, faCompress,
 faSearch, faBarcode, faLink, faBan, faRuler as faRulerIcon,
 faDollarSign, faExclamationTriangle, faChevronRight as faChevRight, faFileInvoiceDollar, faCube,
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

export default function BimQuantitativosOverlay({ onClose, onShowInModel, empreendimentoContextId, modelosContextIds }) {
 const supabase = createClient();
 const { organizacao_id, user } = useAuth();

 const [isDropdownEmpAberto, setIsDropdownEmpAberto] = useState(false);
 const [isBimModalAberto, setIsBimModalAberto] = useState(false);
 const [buscaElemento, setBuscaElemento] = useState('');
 const [medidasSelecionadas, setMedidasSelecionadas] = useState({});
 const [abaAtiva, setAbaAtiva] = useState('elementos'); // 'elementos' | 'por-material'
 const [apenasNaoMapeados, setApenasNaoMapeados] = useState(false);
 const [tipoVisualizacao, setTipoVisualizacao] = useState('etapa'); // 'etapa' | 'categoria' | 'material'
 const dropdownRef = useRef(null);

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
 categoriasExpandidas, toggleCategoria, expandirTodas, recolherTodas,
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
 kpisMaterial,
 atualizarFatorMaterial,
 propriedadesMapeadas,
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

 // ─── Agrupamento de Orçamento por Etapas ─────────────────────────────────────
 const quantitativosAgrupados = useMemo(() => {
 const grupos = {};
 quantitativoPorMaterial.forEach(item => {
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

 return Object.values(grupos).sort((a, b) => {
 if (a.etapa_id === 'sem_etapa') return 1;
 if (b.etapa_id === 'sem_etapa') return -1;
 return a.etapa_nome.localeCompare(b.etapa_nome);
 });
 }, [quantitativoPorMaterial]);

 // ─── Agrupamento de Orçamento por Categoria Revit ─────────────────────────────
  const quantitativosPorCategoria = useMemo(() => {
    const mapCategorias = new Map((mapeamentos || []).map(m => [m.id, m.categoria_bim]));
    const elementosMap = new Map((todosElementos || []).map(el => [el.external_id ? el.external_id.toLowerCase() : '', el]));
    const grupos = {};

    const parseFormulaLocal = (fatorStr, valorBruto) => {
      if (!fatorStr) return valorBruto;
      try {
        const expressao = fatorStr
          .replace(/,/g, '.')
          .replace(/\[quantidade\]|\[q\]/gi, valorBruto.toString());
        const fn = new Function('return ' + expressao);
        const resultado = fn();
        return typeof resultado === 'number' && !isNaN(resultado) ? resultado : valorBruto;
      } catch (e) {
        return valorBruto;
      }
    };

    quantitativoPorMaterial.forEach(item => {
      const keyMaterialBase = item.material_id 
        ? `mat_${item.material_id}` 
        : (item.sinapi_id ? `sinapi_${item.sinapi_id}` : `nome_${item.nome}`);

      // Se for avulso, não há elementos vinculados fisicamente. Vai direto para "Materiais do Projeto".
      if (item.is_avulso || !item.mapeamento_id || !item.external_ids_ativos || item.external_ids_ativos.length === 0) {
        const catNome = 'Materiais do Projeto';
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

        if (!g.materiaisMap[keyMaterialBase]) {
          g.materiaisMap[keyMaterialBase] = {
            key: `${catNome}_${keyMaterialBase}`,
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
            pai_mapeamento_id: item.pai_mapeamento_id,
            fator_conversao: item.fator_conversao,
            quantidadeOriginalApenasParaInfo: 0
          };
        }
        const mat = g.materiaisMap[keyMaterialBase];
        mat.quantidade += item.quantidade;
        mat.custo_total += item.custo_total;
        if (item.tem_alertas) mat.tem_alertas = true;
        if (item.quantidadeOriginalApenasParaInfo) {
          mat.quantidadeOriginalApenasParaInfo += item.quantidadeOriginalApenasParaInfo;
        } else if (item.fator_conversao) {
          mat.quantidadeOriginalApenasParaInfo += item.quantidadeOriginalApenasParaInfo || item.quantidade;
        }
        return;
      }

      // Se não for avulso, vamos descobrir a categoria real de cada elemento que gerou a quantidade!
      const mapObj = (mapeamentos || []).find(m => m.id === item.mapeamento_id);
      const propNome = mapObj ? mapObj.propriedade_nome : null;
      const catBim = mapCategorias.get(item.mapeamento_id);

      // Se não tivermos o nome da propriedade para ler dos elementos, caímos no agrupamento clássico pela categoria do mapeamento ou default
      if (!propNome) {
        let catNome = catBim || 'Materiais do Projeto';

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

        if (!g.materiaisMap[keyMaterialBase]) {
          g.materiaisMap[keyMaterialBase] = {
            key: `${catNome}_${keyMaterialBase}`,
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
            pai_mapeamento_id: item.pai_mapeamento_id,
            fator_conversao: item.fator_conversao,
            quantidadeOriginalApenasParaInfo: 0
          };
        }
        const mat = g.materiaisMap[keyMaterialBase];
        mat.quantidade += item.quantidade;
        mat.qtd_elementos += item.qtd_elementos;
        mat.custo_total += item.custo_total;
        if (item.tem_alertas) mat.tem_alertas = true;
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
        return;
      }

      // Temos a propriedade! Vamos decompor os elementos ativos
      item.external_ids_ativos.forEach(extId => {
        const el = elementosMap.get(extId ? extId.toLowerCase() : '');
        // Categoria real do elemento com fallback para a categoria do mapeamento ou default
        const catNome = el ? (el.categoria || 'Materiais do Projeto') : (catBim || 'Materiais do Projeto');

        if (!grupos[catNome]) {
          grupos[catNome] = {
            categoria_nome: catNome,
            custo_total: 0,
            tem_alertas: false,
            materiaisMap: {}
          };
        }

        const g = grupos[catNome];

        if (!g.materiaisMap[keyMaterialBase]) {
          g.materiaisMap[keyMaterialBase] = {
            key: `${catNome}_${keyMaterialBase}`,
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
            pai_mapeamento_id: item.pai_mapeamento_id,
            fator_conversao: item.fator_conversao,
            quantidadeOriginalApenasParaInfo: 0
          };
        }

        const mat = g.materiaisMap[keyMaterialBase];

        let qtdElemento = 0;
        let originalElemento = 0;

        if (el) {
          // Lê a propriedade física do elemento
          const valorBrutoStr = el.propriedades?.[propNome];
          const valorBruto = parseFloat((valorBrutoStr || '').replace(',', '.'));
          if (!isNaN(valorBruto) && valorBruto > 0) {
            originalElemento = valorBruto;
            qtdElemento = parseFormulaLocal(item.fator_conversao, valorBruto);
          } else {
            // Fallback para mapeamento do tipo 'elemento' onde a quantidade é unitária
            originalElemento = 1.0;
            qtdElemento = parseFormulaLocal(item.fator_conversao, 1.0);
          }
        } else {
          // Se não temos o elemento carregado ainda na memória (ou a query está carregando),
          // estimamos de forma proporcional dividindo a quantidade total do item pelo número de elementos ativos.
          // Isso garante que o valor e custos totais do orçamento não fiquem distorcidos ou zerados/unitários.
          originalElemento = item.quantidadeOriginalApenasParaInfo ? (item.quantidadeOriginalApenasParaInfo / item.external_ids_ativos.length) : (item.quantidade / item.external_ids_ativos.length);
          qtdElemento = item.quantidade / item.external_ids_ativos.length;
        }

        const custoElemento = qtdElemento * item.preco_unitario;

        mat.quantidade += qtdElemento;
        mat.quantidadeOriginalApenasParaInfo += originalElemento;
        mat.custo_total += custoElemento;
        mat.qtd_elementos += 1;
        if (!mat.external_ids_ativos.includes(extId)) {
          mat.external_ids_ativos.push(extId);
        }

        // Acumula o custo total no grupo da categoria
        g.custo_total += custoElemento;
      });

      // Se houver elementos inativos (removidos), tratamos
      if (item.external_ids_inativos && item.external_ids_inativos.length > 0) {
        item.external_ids_inativos.forEach(extId => {
          const el = elementosMap.get(extId ? extId.toLowerCase() : '');
          const catNome = el ? (el.categoria || 'Materiais do Projeto') : (catBim || 'Materiais do Projeto');

          if (grupos[catNome] && grupos[catNome].materiaisMap[keyMaterialBase]) {
            const mat = grupos[catNome].materiaisMap[keyMaterialBase];
            if (!mat.external_ids_inativos.includes(extId)) {
              mat.external_ids_inativos.push(extId);
            }
            mat.tem_alertas = true;
            grupos[catNome].tem_alertas = true;
          }
        });
      }
    });

    // Converte os materiaisMap para arrays reais em cada categoria
    const listaGrupos = Object.values(grupos).map(g => {
      return {
        categoria_nome: g.categoria_nome,
        custo_total: g.custo_total,
        tem_alertas: g.tem_alertas,
        materiais: Object.values(g.materiaisMap).sort((a, b) => b.custo_total - a.custo_total)
      };
    });

    return listaGrupos.sort((a, b) => {
      if (a.categoria_nome === 'Materiais do Projeto') return 1;
      if (b.categoria_nome === 'Materiais do Projeto') return -1;
      return a.categoria_nome.localeCompare(b.categoria_nome);
    });
  }, [quantitativoPorMaterial, mapeamentos, todosElementos]);

 // ─── Agrupamento de Orçamento por Material Consolidado ────────────────────────
 const quantitativosPorMaterialConsolidado = useMemo(() => {
 const grupos = {};

 quantitativoPorMaterial.forEach(item => {
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
 is_avulso: item.is_avulso
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

 return Object.values(grupos).sort((a, b) => b.custo_total - a.custo_total);
 }, [quantitativoPorMaterial]);

  const renderMaterialRow = (item, paddingClass = "pl-12") => {
    return (
      <tr
        key={item.key}
        className={`border-b border-gray-100 hover:bg-white transition-colors ${
          item.tem_alertas ? 'bg-amber-50/20' : 'bg-white'
        }`}
      >
        <td className={`px-4 py-2 ${paddingClass} border-l-2 border-transparent hover:border-blue-400`}>
          <div className="flex items-center gap-2">
            {item.tem_alertas && (
              <span title={`${item.external_ids_inativos.length} elementos removidos do modelo`}>
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-400 text-[10px]" />
              </span>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-700">{item.nome}</p>
              {item.tem_alertas && (
                <p className="text-[9px] text-amber-600">
                  {item.external_ids_inativos.length} elem. removidos do 3D
                </p>
              )}
              {item.pai_mapeamento_id && (
                <p className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5" title="A quantidade desta linha depende da quantidade de outro Material">
                  <FontAwesomeIcon icon={faLink} className="mr-1" />
                  Composição Filha
                </p>
              )}
              {item.is_avulso && !item.pai_mapeamento_id && (
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

 // Enviar comando ao BIM Manager para destacar os elementos
 const handleShowInModel = (externalIds, label) => {
 if (!externalIds || externalIds.length === 0) {
 toast.warning('Nenhum elemento associado encontrado para exibir.');
 return;
 }
 // Chama a prop passando dados ao invés de usar localStorage/router
 if (onShowInModel) {
 onShowInModel(externalIds, label, modelos);
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
 'un': 'bg-gray-50 text-gray-600 border-gray-200',
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

  // Filtra grupos por busca e toggle não mapeados — agora com estrutura 3 níveis
  const gruposFiltrados = useMemo(() => {
    let resultado = grupos;

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
  }, [grupos, buscaElemento, apenasNaoMapeados, tipoTemMapeamento]);

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
 <div key={m.chave} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
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
 className="w-full text-left bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-lg px-3 py-2 transition-all"
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
 <div className="space-y-0 border border-gray-100 rounded-lg overflow-hidden">
 {propKeys.map((k, i) => {
 const jaMapeada = propriedadesMapeadas.has(k);
 const valNum = parseFloat(props[k]);
 const temValor = !isNaN(valNum) && valNum > 0;
 return (
 <div
 key={k}
 className={`flex items-center gap-2 px-3 py-2 text-xs ${
 i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
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
  <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0 shadow-sm relative overflow-hidden">
  
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
 {[{ v: 'elementos', label: 'Elementos BIM', icon: faCubes }, { v: 'por-material', label: `Orçamentação${kpisMaterial.totalMapeados > 0 ? ` (${kpisMaterial.totalMapeados})` : ''}`, icon: faFileInvoiceDollar }]
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
 {abaAtiva === 'elementos' && (
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
 {abaAtiva === 'por-material' && (
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

 {/* Tabela de Elementos */}
 <div className="flex-1 overflow-y-auto">
 {/* ─── ABA: POR MATERIAL ─── */}
 {abaAtiva === 'por-material' && (
 <div className="p-5">
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
 <span className="text-xs">Abra um elemento no sidebar e clique em &quot;<FontAwesomeIcon icon={faLink} className="mx-1" /> vincular&quot; numa propriedade.</span>
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
 {' · '}<strong>{todosElementos.length.toLocaleString('pt-BR')}</strong> elementos no escopo
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
    
    <div className="text-[11px] text-gray-500 font-semibold bg-gray-50/75 px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm">
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
  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Material</th>
  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Unid.</th>
  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Quantidade</th>
  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">R$ Unit.</th>
  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Est.</th>
  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Elem.</th>
  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
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
            <td colSpan={4} className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={isExpandido ? faAngleDown : faAngleRight} className="text-blue-500 w-3" />
                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                  {grupo.etapa_nome}
                </h3>
                {grupo.tem_alertas && <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 ml-2" title="Possui itens com alertas/removidos" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const ids = Object.values(grupo.subetapas).flatMap(s => s.materiais.flatMap(m => m.external_ids_ativos));
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
          {isExpandido && Object.values(grupo.subetapas).map(sub => (
            <Fragment key={sub.subetapa_id}>
              {/* Cabeçalho Subetapa (se houver nome) */}
              {sub.subetapa_nome && (
                <tr className="bg-gray-100 border-t border-gray-200">
                  <td colSpan={4} className="px-8 py-2">
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
      carregandoTodosElementos ? (
        <tr>
          <td colSpan={7} className="px-4 py-20 text-center">
            <div className="flex flex-col items-center justify-center text-blue-600 font-bold gap-3 animate-pulse">
              <FontAwesomeIcon icon={faSpinner} spin className="text-2xl" />
              <span className="text-xs">Mapeando elementos às categorias reais do Revit...</span>
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
              <td colSpan={4} className="px-4 py-2.5">
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
 <td colSpan={4} className="px-4 py-2.5 text-xs font-extrabold text-gray-600 uppercase tracking-wide">Total Estimado</td>
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
 {(abaAtiva === 'elementos' || !modelosSelecionadosIds || modelosSelecionadosIds.length === 0) && (
 <>
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
        onClick={() => {
          let ids = (cat.familias || []).flatMap(f => (f.tipos || []).flatMap(t => (t.elementos || []).map(el => el.external_id)));
          if (ids.length === 0) {
            ids = elementosCat.map(el => el.external_id);
          }
          if (ids.length === 0) {
            const toastId = toast.loading(`Buscando elementos da categoria ${cat.categoria}...`);
            supabase
              .from('elementos_bim')
              .select('external_id')
              .in('projeto_bim_id', modelosSelecionadosIds.map(Number))
              .eq('categoria', cat.categoria)
              .then(({ data, error }) => {
                toast.dismiss(toastId);
                if (error) {
                  console.error(error);
                  toast.error(`Erro ao buscar elementos da categoria.`);
                  return;
                }
                const queryIds = (data || []).map(el => el.external_id);
                if (queryIds.length > 0) {
                  handleShowInModel(queryIds, cat.categoria);
                } else {
                  toast.warning('Nenhum elemento associado encontrado para exibir.');
                }
              });
          } else {
            handleShowInModel(ids, cat.categoria);
          }
        }}
        className="w-7 h-7 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-all"
        title="Visualizar Categoria no 3D"
      >
        <FontAwesomeIcon icon={faCubes} className="text-xs" />
      </button>
      {mapeamentoCat ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
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
            setVinculoModal({
              propriedade: { nome: '', valor: 0, unidade: 'un' },
              elemento: {
                categoria: cat.categoria,
                familia: null,
                tipo: null
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
        onClick={() => {
          let ids = (fam.tipos || []).flatMap(t => (t.elementos || []).map(el => el.external_id));
          if (ids.length === 0) {
            ids = elementosFam.map(el => el.external_id);
          }
          if (ids.length === 0) {
            const toastId = toast.loading(`Buscando elementos da família ${fam.familia}...`);
            supabase
              .from('elementos_bim')
              .select('external_id')
              .in('projeto_bim_id', modelosSelecionadosIds.map(Number))
              .eq('categoria', cat.categoria)
              .eq('familia', fam.familia)
              .then(({ data, error }) => {
                toast.dismiss(toastId);
                if (error) {
                  console.error(error);
                  toast.error(`Erro ao buscar elementos da família.`);
                  return;
                }
                const queryIds = (data || []).map(el => el.external_id);
                if (queryIds.length > 0) {
                  handleShowInModel(queryIds, fam.familia);
                } else {
                  toast.warning('Nenhum elemento associado encontrado para exibir.');
                }
              });
          } else {
            handleShowInModel(ids, fam.familia);
          }
        }}
        className="w-7 h-7 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-all"
        title="Visualizar Família no 3D"
      >
        <FontAwesomeIcon icon={faCubes} className="text-xs" />
      </button>
      {mapeamentoFam ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
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
            setVinculoModal({
              propriedade: { nome: '', valor: 0, unidade: 'un' },
              elemento: {
                categoria: cat.categoria,
                familia: fam.familia,
                tipo: null
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
        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100 font-mono">
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
        onClick={() => {
          const ids = (t.elementos || []).map(el => el.external_id);
          if (ids.length === 0) {
            const toastId = toast.loading(`Buscando elementos do tipo ${t.tipo}...`);
            supabase
              .from('elementos_bim')
              .select('external_id')
              .in('projeto_bim_id', modelosSelecionadosIds.map(Number))
              .eq('categoria', cat.categoria)
              .eq('familia', fam.familia)
              .eq('tipo', t.tipo)
              .then(({ data, error }) => {
                toast.dismiss(toastId);
                if (error) {
                  console.error(error);
                  toast.error(`Erro ao buscar elementos do tipo.`);
                  return;
                }
                const queryIds = (data || []).map(el => el.external_id);
                if (queryIds.length > 0) {
                  handleShowInModel(queryIds, t.tipo);
                } else {
                  toast.warning('Nenhum elemento associado encontrado para exibir.');
                }
              });
          } else {
            handleShowInModel(ids, t.tipo);
          }
        }}
        className="w-7 h-7 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-all"
        title="Visualizar Tipo no 3D"
      >
        <FontAwesomeIcon icon={faCubes} className="text-xs" />
      </button>
      {mapeamentoTipo ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
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
            setVinculoModal({
              propriedade: { nome: '', valor: 0, unidade: 'un' },
              elemento: {
                categoria: cat.categoria,
                familia: fam.familia,
                tipo: t.tipo
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
    className={`border-b border-gray-50 cursor-pointer transition-colors duration-1000 ${
      linhaDestacadaChave === `el-${el.id}` 
        ? 'bg-emerald-100/80 transition-none' 
        : 'bg-amber-50/20 hover:bg-amber-50/60'
    }`}
  >
  <td className="px-3 py-1.5 pl-16 text-amber-300 text-center">
  <FontAwesomeIcon icon={faAngleRight} className="text-[10px] opacity-25" />
  </td>
  <td className="px-4 py-1.5 text-[10px] text-gray-500">
  Nome: <span className="font-mono text-gray-600">{props['Name'] || props['Nome'] || props['Mark'] || props['Marca'] || 'Instância'}</span>
  </td>
  <td className="px-4 py-1.5 text-right text-[10px] text-gray-600 font-medium">
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
        onClick={() => handleShowInModel([el.external_id], props['Name'] || props['Nome'] || 'Instância')}
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
          className="w-6 h-6 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-all"
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
 </>
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
      onVincularPropriedade={(propNome, propValor) => 
        handleVincularPropriedadeDeElemento(propNome, propValor, inspecaoModal.elemento)
      }
    />
  )}

 {/* ─── MODAL: Gerenciar/Desvincular Regras do Material ─── */}
 <BimGerenciarVinculosModal
 isOpen={!!materialGerenciar}
 onClose={() => setMaterialGerenciar(null)}
 materialOuSinapi={materialGerenciar}
 mapeamentos={mapeamentos}
 onExcluir={handleExcluirMapeamento}
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
 </div>
 );
}
