// hooks/bim/useBimQuantitativos.js
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

/**
 * Hook de dados para a página BIM Quantitativos.
 * Gerencia: seleção de empreendimento, modelos BIM e elementos agrupados.
 */
export function useBimQuantitativos({ organizacaoId }) {
  const supabase = createClient();

  // ─── Estados de Seleção ───────────────────────────────────────────────
  const [empreendimentoSelecionadoId, setEmpreendimentoSelecionadoId] = useState('');
  const [modelosSelecionadosIds, setModelosSelecionadosIds] = useState([]);
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(new Set());
  const [categoriasVisiveis, setCategoriasVisiveis] = useState(new Set());
  const restauradoRef = useRef(false);

  // Restaura última seleção do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedEmp = localStorage.getItem('studio57_bim_quant_emp_id');
    if (savedEmp) setEmpreendimentoSelecionadoId(savedEmp);
  }, []);

  const handleSelectEmpreendimento = (id) => {
    setEmpreendimentoSelecionadoId(id);
    setModelosSelecionadosIds([]); // Reseta modelos ao trocar empreendimento
    restauradoRef.current = false; // Permite restaurar de novo para o novo empreendimento
    localStorage.setItem('studio57_bim_quant_emp_id', id);
    localStorage.removeItem('studio57_bim_quant_modelos_ids');
  };

  const handleSelectModelos = (ids) => {
    setModelosSelecionadosIds(ids);
    setCategoriasExpandidas(new Set()); // Fecha todos os grupos ao trocar modelo
    localStorage.setItem('studio57_bim_quant_modelos_ids', JSON.stringify(ids));
  };

  // ─── Query 1: Empreendimentos que têm modelos BIM com elementos ──────
  const { data: empreendimentosRaw = [], isLoading: carregandoEmpreendimentos } = useQuery({
    queryKey: ['bimQuant_empreendimentos', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];

      // Busca IDs de empreendimentos que têm modelos BIM ativos com elementos extraídos (ignorando apenas modelos com erro)
      const { data: modData, error: modError } = await supabase
        .from('projetos_bim')
        .select('empreendimento_id')
        .eq('organizacao_id', organizacaoId)
        .eq('is_lixeira', false)
        .neq('status', 'Erro')
        .not('empreendimento_id', 'is', null);

      if (modError) throw modError;

      const empIds = [...new Set((modData || []).map(m => m.empreendimento_id).filter(Boolean))];
      if (empIds.length === 0) return [];

      // Busca os dados completos desses empreendimentos com empresa
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, empresa:empresa_proprietaria_id(id, nome_fantasia, razao_social)')
        .in('id', empIds)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizacaoId,
    staleTime: 5 * 60 * 1000,
  });

  // Agrupa empreendimentos por empresa (mesmo padrão do ExtratoManager)
  const empreendimentosAgrupados = useMemo(() => {
    const grupos = {};
    empreendimentosRaw.forEach(emp => {
      const nomeEmpresa = emp.empresa?.nome_fantasia || emp.empresa?.razao_social || 'Sem Empresa';
      if (!grupos[nomeEmpresa]) grupos[nomeEmpresa] = [];
      grupos[nomeEmpresa].push(emp);
    });
    return Object.entries(grupos)
      .map(([empresa, lista]) => ({ empresa, empreendimentos: lista }))
      .sort((a, b) => a.empresa.localeCompare(b.empresa));
  }, [empreendimentosRaw]);

  const empreendimentoSelecionado = useMemo(
    () => empreendimentosRaw.find(e => String(e.id) === String(empreendimentoSelecionadoId)),
    [empreendimentosRaw, empreendimentoSelecionadoId]
  );

  // Auto-select primeiro empreendimento se não houver seleção
  useEffect(() => {
    if (!empreendimentoSelecionadoId && empreendimentosRaw.length > 0) {
      const savedId = localStorage.getItem('studio57_bim_quant_emp_id');
      const validSaved = savedId && empreendimentosRaw.some(e => String(e.id) === savedId);
      if (validSaved) {
        setEmpreendimentoSelecionadoId(savedId);
      } else {
        handleSelectEmpreendimento(String(empreendimentosRaw[0].id));
      }
    }
  }, [empreendimentosRaw, empreendimentoSelecionadoId]);

  // ─── Query 2: Modelos BIM do Empreendimento (Ignorando apenas os com status Erro) ───────────────────────────
  const { data: modelos = [], isLoading: carregandoModelos } = useQuery({
    queryKey: ['bimQuant_modelos', empreendimentoSelecionadoId, organizacaoId],
    queryFn: async () => {
      if (!empreendimentoSelecionadoId || !organizacaoId) return [];
      const { data, error } = await supabase
        .from('projetos_bim')
        .select('id, nome_arquivo, status, versao, criado_em, urn_autodesk, empreendimento_id, disciplinas_projetos:disciplina_id(nome)')
        .eq('empreendimento_id', empreendimentoSelecionadoId)
        .eq('organizacao_id', organizacaoId)
        .eq('is_lixeira', false)
        .neq('status', 'Erro')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empreendimentoSelecionadoId && !!organizacaoId,
    staleTime: 2 * 60 * 1000,
  });

  const modelosSelecionados = useMemo(
    () => modelos.filter(m => modelosSelecionadosIds.includes(String(m.id))),
    [modelos, modelosSelecionadosIds]
  );
  const modeloSelecionado = modelosSelecionados[0] || null;

  // Restaura modelos selecionados do localStorage apenas uma vez após serem carregados
  useEffect(() => {
    if (restauradoRef.current || modelos.length === 0) return;
    restauradoRef.current = true;
    const saved = localStorage.getItem('studio57_bim_quant_modelos_ids');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        const validIds = ids.filter(id => modelos.some(m => String(m.id) === String(id)));
        if (validIds.length > 0) {
          setModelosSelecionadosIds(validIds);
        }
      } catch (e) {}
    }
  }, [modelos]);

  // ─── Estados de Seleção e Carregamento sob Demanda ───────────────────
  const [detalhesFamilias, setDetalhesFamilias] = useState({});
  const [carregandoFamiliasIds, setCarregandoFamiliasIds] = useState(new Set());
  const [familiasPorCategoria, setFamiliasPorCategoria] = useState({});
  const [carregandoCategoriasIds, setCarregandoCategoriasIds] = useState(new Set());

  // Reseta os detalhes das famílias quando a seleção de modelos mudar
  useEffect(() => {
    setDetalhesFamilias({});
    setCarregandoFamiliasIds(new Set());
    setFamiliasPorCategoria({});
    setCarregandoCategoriasIds(new Set());
  }, [modelosSelecionadosIds]);

  // ─── Query 3: Esqueleto de Categorias do Modelo (Banda ultraleve) ───
  const elementosQueryKey = ['bimQuant_esqueleto_categorias', [...modelosSelecionadosIds].sort().join(','), organizacaoId];
  const { data: esqueletoCategorias = [], isLoading: carregandoElementos } = useQuery({
    queryKey: elementosQueryKey,
    queryFn: async () => {
      if (modelosSelecionadosIds.length === 0 || !organizacaoId) return [];

      const { data, error } = await supabase.rpc('get_categorias_projeto', {
        p_projeto_ids: modelosSelecionadosIds.map(Number)
      });

      if (error) throw error;
      return data || [];
    },
    enabled: modelosSelecionadosIds.length > 0 && !!organizacaoId,
    staleTime: 3 * 60 * 1000,
  });

  // Função assíncrona para buscar as famílias de uma categoria sob demanda
  const carregarFamiliasDaCategoria = async (categoria) => {
    if (!categoria || modelosSelecionadosIds.length === 0) return;
    if (familiasPorCategoria[categoria] || carregandoCategoriasIds.has(categoria)) return;

    setCarregandoCategoriasIds(prev => {
      const next = new Set(prev);
      next.add(categoria);
      return next;
    });

    try {
      const { data, error } = await supabase.rpc('get_familias_categoria', {
        p_projeto_ids: modelosSelecionadosIds.map(Number),
        p_categoria: categoria
      });

      if (error) throw error;

      setFamiliasPorCategoria(prev => ({
        ...prev,
        [categoria]: data || []
      }));
    } catch (e) {
      console.error(`Erro ao carregar famílias da categoria ${categoria}:`, e);
    } finally {
      setCarregandoCategoriasIds(prev => {
        const next = new Set(prev);
        next.delete(categoria);
        return next;
      });
    }
  };

  // Função assíncrona para carregar sob demanda os detalhes de uma família (tipos, elementos e propriedades)
  const carregarDetalhesFamilia = async (categoria, familia) => {
    const chave = `${categoria}|||${familia}`;
    if (detalhesFamilias[chave] || carregandoFamiliasIds.has(chave) || modelosSelecionadosIds.length === 0) return;

    setCarregandoFamiliasIds(prev => {
      const next = new Set(prev);
      next.add(chave);
      return next;
    });

    try {
      const { data, error } = await supabase
        .from('elementos_bim')
        .select('id, external_id, categoria, familia, tipo, nivel, propriedades, is_active')
        .in('projeto_bim_id', modelosSelecionadosIds.map(Number))
        .eq('categoria', categoria)
        .eq('familia', familia)
        .limit(100000);

      if (error) throw error;

      // Agrupa os elementos da família por Tipo
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

      const buildMedidas = (acumuladores) =>
        MEDIDAS_CONFIG
          .filter(cfg => acumuladores[cfg.chave]?.qtd_com_valor > 0)
          .reduce((acc, cfg) => {
            const acum = acumuladores[cfg.chave];
            if (!acc.find(m => m.unidade === cfg.unidade && m.label === cfg.label)) {
              acc.push({ chave: cfg.chave, label: cfg.label, unidade: cfg.unidade,
                valor: acum.soma, qtd_com_valor: acum.qtd_com_valor });
            }
            return acc;
          }, [])
          .sort((a, b) => b.qtd_com_valor - a.qtd_com_valor);

      const tipoMap = {};
      (data || []).forEach(el => {
        const tipo = el.tipo || '(sem tipo)';
        if (!tipoMap[tipo]) {
          tipoMap[tipo] = {
            tipo,
            nivel: el.nivel || '—',
            elementos: [],
            sinapi_revit: null,
            external_ids: [],
            _acumuladores: {},
          };
        }
        const g = tipoMap[tipo];
        g.elementos.push(el);
        g.external_ids.push(el.external_id);

        const props = el.propriedades || {};
        if (!g.sinapi_revit && props['SINAPI']) g.sinapi_revit = props['SINAPI'];

        MEDIDAS_CONFIG.forEach(({ chave }) => {
          const val = parseFloat(props[chave]);
          if (isNaN(val) || val <= 0) return;
          if (!g._acumuladores[chave]) g._acumuladores[chave] = { soma: 0, qtd_com_valor: 0 };
          g._acumuladores[chave].soma += val;
          g._acumuladores[chave].qtd_com_valor += 1;
        });

        // Suporte dinâmico para acúmulo de concreto do Eberick/AltoQi na chave 'Volume'
        Object.entries(props).forEach(([chave, valor]) => {
          const val = parseFloat(valor);
          if (isNaN(val) || val <= 0) return;
          if (chave.toLowerCase().startsWith('concreto -') || chave.toLowerCase().includes('concreto - c')) {
            const chaveAcum = 'Volume';
            if (!g._acumuladores[chaveAcum]) g._acumuladores[chaveAcum] = { soma: 0, qtd_com_valor: 0 };
            g._acumuladores[chaveAcum].soma += val;
            g._acumuladores[chaveAcum].qtd_com_valor += 1;
          }
        });
      });

      const tipos = Object.values(tipoMap)
        .map(g => {
          const medidas = buildMedidas(g._acumuladores);
          return {
            tipo: g.tipo,
            nivel: g.nivel,
            elementos: g.elementos,
            external_ids: g.external_ids,
            sinapi_revit: g.sinapi_revit,
            medidas,
            medida_padrao: medidas[0]?.chave || null,
            qtd_total: g.elementos.length,
          };
        })
        .sort((a, b) => a.tipo.localeCompare(b.tipo));

      setDetalhesFamilias(prev => ({
        ...prev,
        [chave]: tipos
      }));
    } catch (e) {
      console.error(`Erro ao carregar detalhes da família ${chave}:`, e);
    } finally {
      setCarregandoFamiliasIds(prev => {
        const next = new Set(prev);
        next.delete(chave);
        return next;
      });
    }
  };

  // Mescla o esqueleto macro com os detalhes carregados sob demanda
  const grupos = useMemo(() => {
    if (!esqueletoCategorias) return [];

    return esqueletoCategorias.map(cat => {
      const listaFam = familiasPorCategoria[cat.categoria] || [];

      const familiasEnriquecidas = listaFam.map(fam => {
        const chave = `${cat.categoria}|||${fam.familia}`;
        const tiposCarregados = detalhesFamilias[chave] || [];
        const carregando = carregandoFamiliasIds.has(chave);

        // Calcula a área total a partir dos tipos da família
        const areaTotal = tiposCarregados.reduce((acc, t) => {
          const m = t.medidas.find(med => med.unidade === 'm²');
          return acc + (m?.valor || 0);
        }, 0);

        return {
          familia: fam.familia,
          total_elementos: Number(fam.total_elementos || 0),
          tipos: tiposCarregados,
          carregando,
          area_total: areaTotal
        };
      });

      const areaTotalCategoria = familiasEnriquecidas.reduce((acc, f) => acc + f.area_total, 0);
      const carregandoFamilias = carregandoCategoriasIds.has(cat.categoria);

      return {
        categoria: cat.categoria,
        total_elementos: Number(cat.total_elementos || 0),
        area_total_categoria: areaTotalCategoria,
        familias: familiasEnriquecidas,
        carregandoFamilias
      };
    });
  }, [esqueletoCategorias, familiasPorCategoria, detalhesFamilias, carregandoFamiliasIds, carregandoCategoriasIds]);

  // Query flat desativada - o cálculo e agrupamento de categorias BIM agora é feito 100% no banco de dados via RPC
  const todosElementos = [];
  const carregandoTodosElementos = false;

  // Query 5 desativada - Cálculo de Orçamento foi portado 100% para o Banco de Dados (RPC)
  const todosElementosEmpreendimento = [];
  const carregandoElementosEmp = false;

  // ─── KPIs do Modelo ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalElementos = grupos.reduce((acc, g) => acc + g.total_elementos, 0);
    const totalCategorias = grupos.length;
    const areaTotal = grupos.reduce((acc, g) => acc + g.area_total_categoria, 0);
    const comSinapi = grupos.reduce(
      (acc, g) => acc + g.familias.flatMap(f => f.tipos).filter(t => t.sinapi_revit).length, 0
    );
    return { totalElementos, totalCategorias, areaTotal, comSinapi };
  }, [grupos]);

  // ─── Controle de Categorias Expandidas ───────────────────────────────
  const toggleCategoria = (categoria) => {
    setCategoriasExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(categoria)) next.delete(categoria);
      else next.add(categoria);
      return next;
    });
  };

  const expandirTodas = () => setCategoriasExpandidas(new Set(grupos.map(g => g.categoria)));
  const recolherTodas = () => setCategoriasExpandidas(new Set());

  return {
    // Empreendimentos
    empreendimentosAgrupados,
    carregandoEmpreendimentos,
    empreendimentoSelecionadoId,
    empreendimentoSelecionado,
    handleSelectEmpreendimento,
    // Modelos
    modelos,
    carregandoModelos,
    modeloSelecionadoId: modelosSelecionadosIds[0] || null,
    modelosSelecionadosIds,
    modeloSelecionado,
    modelosSelecionados,
    handleSelectModelo: handleSelectModelos,
    handleSelectModelos,
    // Elementos do modelo selecionado
    grupos,
    todosElementos,              // flat do modelo selecionado (vazio)
    carregandoElementos,
    carregandoTodosElementos,
    kpis,
    // Elementos do empreendimento inteiro (Por Material)
    todosElementosEmpreendimento,
    carregandoElementosEmp,
    // UI
    categoriasExpandidas,
    toggleCategoria,
    expandirTodas,
    recolherTodas,
    // Lazy Loading
    carregarFamiliasDaCategoria,
    carregarDetalhesFamilia,
  };
}
