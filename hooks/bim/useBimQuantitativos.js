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

      // Busca IDs de empreendimentos que têm modelos BIM com elementos extraídos
      const { data: modData, error: modError } = await supabase
        .from('projetos_bim')
        .select('empreendimento_id')
        .eq('organizacao_id', organizacaoId)
        .eq('is_lixeira', false)
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

  // ─── Query 2: Modelos BIM do Empreendimento ───────────────────────────
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

  // Reseta os detalhes das famílias quando a seleção de modelos mudar
  useEffect(() => {
    setDetalhesFamilias({});
    setCarregandoFamiliasIds(new Set());
  }, [modelosSelecionadosIds]);

  // ─── Query 3: Esqueleto da Árvore de Elementos (Rápida - sem propriedades) ───
  const elementosQueryKey = ['bimQuant_esqueleto', [...modelosSelecionadosIds].sort().join(','), organizacaoId];
  const { data: esqueleto = [], isLoading: carregandoElementos } = useQuery({
    queryKey: elementosQueryKey,
    queryFn: async () => {
      if (modelosSelecionadosIds.length === 0 || !organizacaoId) return [];

      // Chama a RPC get_esqueleto_elementos_bim que agrupa Categoria -> Família no banco e faz bypass do limite
      const { data, error } = await supabase.rpc('get_esqueleto_elementos_bim', {
        p_projeto_ids: modelosSelecionadosIds.map(Number)
      });

      if (error) throw error;

      // Agrupa Categoria -> Família no frontend baseado no retorno consolidado da RPC
      const mapa = {};
      (data || []).forEach(row => {
        const cat = row.categoria || 'Sem Categoria';
        const fam = row.familia || '—';
        const total = Number(row.total_elementos || 0);

        if (!mapa[cat]) mapa[cat] = {};
        mapa[cat][fam] = (mapa[cat][fam] || 0) + total;
      });

      return Object.entries(mapa)
        .map(([categoria, famMap]) => {
          const familias = Object.entries(famMap).map(([familia, total]) => ({
            familia,
            total_elementos: total,
            tipos: [],
            carregando: false,
            area_total: 0
          })).sort((a, b) => a.familia.localeCompare(b.familia));

          const totalElementos = familias.reduce((sum, f) => sum + f.total_elementos, 0);

          return {
            categoria,
            total_elementos: totalElementos,
            area_total_categoria: 0,
            familias
          };
        })
        .sort((a, b) => a.categoria.localeCompare(b.categoria));
    },
    enabled: modelosSelecionadosIds.length > 0 && !!organizacaoId,
    staleTime: 3 * 60 * 1000,
  });

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
        .in('projeto_bim_id', modelosSelecionadosIds)
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
    if (!esqueleto) return [];

    return esqueleto.map(cat => {
      const familiasEnriquecidas = cat.familias.map(fam => {
        const chave = `${cat.categoria}|||${fam.familia}`;
        const tiposCarregados = detalhesFamilias[chave] || [];
        const carregando = carregandoFamiliasIds.has(chave);

        // Calcula a área total a partir dos tipos da família
        const areaTotal = tiposCarregados.reduce((acc, t) => {
          const m = t.medidas.find(med => med.unidade === 'm²');
          return acc + (m?.valor || 0);
        }, 0);

        return {
          ...fam,
          tipos: tiposCarregados,
          carregando,
          area_total: areaTotal
        };
      });

      const areaTotalCategoria = familiasEnriquecidas.reduce((acc, f) => acc + f.area_total, 0);

      return {
        ...cat,
        area_total_categoria: areaTotalCategoria,
        familias: familiasEnriquecidas,
      };
    });
  }, [esqueleto, detalhesFamilias, carregandoFamiliasIds]);

  // Lista flat de todos os elementos (inclui ativos e inativos) para mapeamentos
  const { data: todosElementos = [] } = useQuery({
    queryKey: ['bimQuant_elementos_flat', [...modelosSelecionadosIds].sort().join(','), organizacaoId],
    queryFn: async () => {
      if (modelosSelecionadosIds.length === 0 || !organizacaoId) return [];
      const { data, error } = await supabase
        .from('elementos_bim')
        .select('id, external_id, categoria, familia, tipo, nivel, propriedades, is_active')
        .in('projeto_bim_id', modelosSelecionadosIds)
        .not('categoria', 'in', '("Revit Level","Revit Grids","Revit Scope Boxes","Revit Reference Planes","<Indesejado>")')
        .limit(100000);
      if (error) throw error;
      return data || [];
    },
    enabled: modelosSelecionadosIds.length > 0 && !!organizacaoId,
    staleTime: 3 * 60 * 1000,
  });

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
    todosElementos,              // flat do modelo selecionado (para preview de impacto no modal)
    carregandoElementos,
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
    carregarDetalhesFamilia,
  };
}
