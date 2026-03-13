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
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState('');
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
        .select('id, nome_arquivo, status, versao, criado_em, disciplinas_projetos:disciplina_id(nome)')
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

  const modeloSelecionado = useMemo(
    () => modelos.find(m => String(m.id) === String(modeloSelecionadoId)),
    [modelos, modeloSelecionadoId]
  );

  // Auto-select primeiro modelo se não houver seleção
  useEffect(() => {
    if (!modeloSelecionadoId && modelos.length > 0) {
      const savedId = localStorage.getItem('studio57_bim_quant_modelo_id');
      const validSaved = savedId && modelos.some(m => String(m.id) === savedId);
      handleSelectModelo(validSaved ? savedId : String(modelos[0].id));
    }
  }, [modelos, modeloSelecionadoId]);

  // ─── Query 3: Elementos Agrupados do Modelo ───────────────────────────
  const { data: grupos = [], isLoading: carregandoElementos } = useQuery({
    queryKey: ['bimQuant_elementos', modeloSelecionadoId, organizacaoId],
    queryFn: async () => {
      if (!modeloSelecionadoId || !organizacaoId) return [];

      // Busca todos os elementos do modelo (sem agrupar no banco para manter flexibilidade)
      const { data, error } = await supabase
        .from('elementos_bim')
        .select('id, external_id, categoria, familia, tipo, nivel, propriedades')
        .eq('projeto_bim_id', modeloSelecionadoId)
        .eq('is_active', true)
        // Exclui categorias auxiliares (níveis, grids, etc.)
        .not('categoria', 'in', '("Revit Level","Revit Grids","Revit Scope Boxes","Revit Reference Planes","<Indesejado>")');

      if (error) throw error;

      // Agrupa client-side por Categoria → Família/Tipo
      const mapaGrupos = {};
      (data || []).forEach(el => {
        const categoriaKey = el.categoria || 'Sem Categoria';
        const familiaKey = `${el.familia || ''}|||${el.tipo || ''}`;

        if (!mapaGrupos[categoriaKey]) mapaGrupos[categoriaKey] = {};
        if (!mapaGrupos[categoriaKey][familiaKey]) {
          mapaGrupos[categoriaKey][familiaKey] = {
            familia: el.familia || '—',
            tipo: el.tipo || '',
            nivel: el.nivel || '—',
            elementos: [],
            area_total: 0,
            volume_total: 0,
            sinapi_revit: null,
            external_ids: [],
          };
        }

        const g = mapaGrupos[categoriaKey][familiaKey];
        g.elementos.push(el);
        g.external_ids.push(el.external_id);

        // Extrai quantidades do JSONB propriedades
        const props = el.propriedades || {};
        const area = parseFloat(props['Área'] || props['Area'] || 0);
        const volume = parseFloat(props['Volume'] || 0);
        if (!isNaN(area)) g.area_total += area;
        if (!isNaN(volume)) g.volume_total += volume;
        if (!g.sinapi_revit && props['SINAPI']) g.sinapi_revit = props['SINAPI'];
      });

      // Transforma para array ordenado
      return Object.entries(mapaGrupos)
        .map(([categoria, famMap]) => ({
          categoria,
          total_elementos: Object.values(famMap).reduce((acc, g) => acc + g.elementos.length, 0),
          area_total_categoria: Object.values(famMap).reduce((acc, g) => acc + g.area_total, 0),
          grupos: Object.entries(famMap)
            .map(([_key, g]) => g)
            .sort((a, b) => a.familia.localeCompare(b.familia)),
        }))
        .sort((a, b) => a.categoria.localeCompare(b.categoria));
    },
    enabled: !!modeloSelecionadoId && !!organizacaoId,
    staleTime: 3 * 60 * 1000,
  });

  // ─── KPIs do Modelo ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalElementos = grupos.reduce((acc, g) => acc + g.total_elementos, 0);
    const totalCategorias = grupos.length;
    const areaTotal = grupos.reduce((acc, g) => acc + g.area_total_categoria, 0);
    const comSinapi = grupos.reduce(
      (acc, g) => acc + g.grupos.filter(sub => sub.sinapi_revit).length, 0
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
    // Elementos
    grupos,
    carregandoElementos,
    kpis,
    // UI
    categoriasExpandidas,
    toggleCategoria,
    expandirTodas,
    recolherTodas,
  };
}
