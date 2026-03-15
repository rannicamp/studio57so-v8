// hooks/bim/useBimQuantitativos.js
'use client';

import { useState, useMemo, useEffect } from 'react';
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

  // Restaura última seleção do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedEmp = localStorage.getItem('studio57_bim_quant_emp_id');
    const savedMod = localStorage.getItem('studio57_bim_quant_modelo_id');
    if (savedEmp) setEmpreendimentoSelecionadoId(savedEmp);
    if (savedMod) setModeloSelecionadoId(savedMod);
  }, []);

  const handleSelectEmpreendimento = (id) => {
    setEmpreendimentoSelecionadoId(id);
    setModeloSelecionadoId(''); // Reseta modelo ao trocar empreendimento
    localStorage.setItem('studio57_bim_quant_emp_id', id);
    localStorage.removeItem('studio57_bim_quant_modelo_id');
  };

  const handleSelectModelo = (id) => {
    setModeloSelecionadoId(String(id));
    setCategoriasExpandidas(new Set()); // Fecha todos os grupos ao trocar modelo
    localStorage.setItem('studio57_bim_quant_modelo_id', String(id));
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

  // Auto-select primeiro modelo se não houver seleção
  useEffect(() => {
    if (modelosSelecionadosIds.length === 0 && modelos.length > 0) {
      const saved = localStorage.getItem('studio57_bim_quant_modelos_ids');
      let validIds = [];
      if (saved) {
        try { validIds = JSON.parse(saved).filter(id => modelos.some(m => String(m.id) === String(id))); } catch(e) {}
      }
      handleSelectModelos(validIds.length > 0 ? validIds : [String(modelos[0].id)]);
    }
  }, [modelos, modelosSelecionadosIds]);

  // ─── Query 3: Elementos Agrupados do Modelo + lista flat ────────────
  const elementosQueryKey = ['bimQuant_elementos', [...modelosSelecionadosIds].sort().join(','), organizacaoId];
  const { data: grupos = [], isLoading: carregandoElementos } = useQuery({
    queryKey: elementosQueryKey,
    queryFn: async () => {
      if (modelosSelecionadosIds.length === 0 || !organizacaoId) return [];

      // Busca todos os elementos do modelo (sem agrupar no banco para manter flexibilidade)
      const { data, error } = await supabase
        .from('elementos_bim')
        .select('id, external_id, categoria, familia, tipo, nivel, propriedades, is_active')
        .in('projeto_bim_id', modelosSelecionadosIds)
        // Inclui inativos também para rastreabilidade
        // .eq('is_active', true)  ← removido para expor inativados
        .not('categoria', 'in', '("Revit Level","Revit Grids","Revit Scope Boxes","Revit Reference Planes","<Indesejado>")');

      if (error) throw error;

      // ── Mapa de medidas reconhecidas → unidades ────────────────────────
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

      // Helper: monta medidas de um acumulador
      const buildMedidas = (acumuladores, qtdTotal) =>
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

      // ── Agrupa: Categoria → Família → Tipo ───────────────────────────
      // mapaGrupos[categoria][familia][tipo] = { elementos, acumuladores, ... }
      const mapaGrupos = {};
      (data || []).forEach(el => {
        const cat  = el.categoria || 'Sem Categoria';
        const fam  = el.familia   || '—';
        const tipo = el.tipo      || '(sem tipo)';

        if (!mapaGrupos[cat]) mapaGrupos[cat] = {};
        if (!mapaGrupos[cat][fam]) mapaGrupos[cat][fam] = {};
        if (!mapaGrupos[cat][fam][tipo]) {
          mapaGrupos[cat][fam][tipo] = {
            tipo,
            nivel: el.nivel || '—',
            elementos: [],
            sinapi_revit: null,
            external_ids: [],
            _acumuladores: {},
          };
        }

        const g = mapaGrupos[cat][fam][tipo];
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

      // ── Transforma para array de 3 níveis ─────────────────────────────
      return Object.entries(mapaGrupos)
        .map(([categoria, famMap]) => {
          // Monta famílias
          const familias = Object.entries(famMap)
            .map(([familia, tipoMap]) => {
              // Monta tipos (folhas da árvore)
              const tipos = Object.entries(tipoMap)
                .map(([_tipoKey, g]) => {
                  const medidas = buildMedidas(g._acumuladores, g.elementos.length);
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

              const totalFamilia = tipos.reduce((acc, t) => acc + t.qtd_total, 0);
              const areaTotalFamilia = tipos.reduce((acc, t) => {
                const m = t.medidas.find(m => m.unidade === 'm²');
                return acc + (m?.valor || 0);
              }, 0);

              return { familia, tipos, total_elementos: totalFamilia, area_total: areaTotalFamilia };
            })
            .sort((a, b) => a.familia.localeCompare(b.familia));

          return {
            categoria,
            total_elementos: familias.reduce((acc, f) => acc + f.total_elementos, 0),
            area_total_categoria: familias.reduce((acc, f) => acc + f.area_total, 0),
            familias,
          };
        })
        .sort((a, b) => a.categoria.localeCompare(b.categoria));
    },
    enabled: modelosSelecionadosIds.length > 0 && !!organizacaoId,
    staleTime: 3 * 60 * 1000,
    // Retorna grupos (estrutura hierárquica) AND todosElementos (flat) juntos
    select: (rawGrupos) => rawGrupos, // grupos já são o retorno da queryFn
  });

  // Lista flat de todos os elementos (inclui ativos e inativos) para mapeamentos
  const { data: todosElementos = [] } = useQuery({
    queryKey: ['bimQuant_elementos_flat', [...modelosSelecionadosIds].sort().join(','), organizacaoId],
    queryFn: async () => {
      if (!modeloSelecionadoId || !organizacaoId) return [];
      const { data, error } = await supabase
        .from('elementos_bim')
        .select('id, external_id, categoria, familia, tipo, nivel, propriedades, is_active')
        .eq('projeto_bim_id', modeloSelecionadoId)
        .not('categoria', 'in', '("Revit Level","Revit Grids","Revit Scope Boxes","Revit Reference Planes","<Indesejado>")');
      if (error) throw error;
      return data || [];
    },
    enabled: !!modeloSelecionadoId && !!organizacaoId,
    staleTime: 3 * 60 * 1000,
  });

  // ─── Query 5: TODOS os elementos do Empreendimento (todos os modelos) ───
  // Usado para calcular quantitativos por material do projeto inteiro
  const { data: todosElementosEmpreendimento = [], isLoading: carregandoElementosEmp } = useQuery({
    queryKey: ['bimQuant_elementos_empreendimento', empreendimentoSelecionadoId, organizacaoId],
    queryFn: async () => {
      if (!empreendimentoSelecionadoId || !organizacaoId) return [];

      // Primeiro: pega os IDs de todos os modelos do empreendimento
      const { data: modelosEmp, error: errMod } = await supabase
        .from('projetos_bim')
        .select('id')
        .eq('empreendimento_id', empreendimentoSelecionadoId)
        .eq('organizacao_id', organizacaoId)
        .eq('is_lixeira', false);
      if (errMod) throw errMod;

      const modeloIds = (modelosEmp || []).map(m => m.id);
      if (modeloIds.length === 0) return [];

      const CATS_IGNORAR = ['Revit Level', 'Revit Grids', 'Revit Scope Boxes',
        'Revit Reference Planes', '<Indesejado>'];

      // Segundo: busca todos os elementos de todos esses modelos
      const { data, error } = await supabase
        .from('elementos_bim')
        .select('id, external_id, categoria, familia, tipo, nivel, propriedades, is_active, projeto_bim_id')
        .in('projeto_bim_id', modeloIds)
        .not('categoria', 'in', `(${CATS_IGNORAR.map(c => `"${c}"`).join(',')})`);
      if (error) {
        console.error('[BimQuant] Erro na query elementos_empreendimento:', error);
        throw error;
      }
      console.log(`[BimQuant] Empreendimento ${empreendimentoSelecionadoId}: ${(data||[]).length} elementos em ${modeloIds.length} modelo(s)`);
      return data || [];
    },
    enabled: !!empreendimentoSelecionadoId && !!organizacaoId,
    staleTime: 5 * 60 * 1000,
  });

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
    modeloSelecionadoId,
    modeloSelecionado,
    handleSelectModelo,
    // Elementos do modelo selecionado
    grupos,
    todosElementos,              // flat do modelo selecionado (para preview de impacto no modal)
    carregandoElementos,
    kpis,
    // Elementos do empreendimento inteiro (para aba Por Material)
    todosElementosEmpreendimento,
    carregandoElementosEmp,
    // UI
    categoriasExpandidas,
    toggleCategoria,
    expandirTodas,
    recolherTodas,
  };
}
