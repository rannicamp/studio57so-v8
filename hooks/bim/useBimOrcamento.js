// Caminho: hooks/bim/useBimOrcamento.js
'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

/**
 * Hook que gerencia todo o fluxo de Importação BIM → Orçamento.
 * Encapsula: busca de modelos, busca de categorias, agrupamento de elementos
 * e a mutation de criação em lote dos itens de orçamento.
 */
export function useBimOrcamento({ empreendimentoId, orcamentoId, organizacaoId }) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Passo atual do wizard (1=Modelo, 2=Categorias, 3=Revisão)
  const [passo, setPasso] = useState(1);

  // Modelo BIM selecionado no Passo 1
  const [modeloSelecionado, setModeloSelecionado] = useState(null);

  // Categorias marcadas no Passo 2
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState([]);

  // Grupos retornados pela API, com edições do usuário no Passo 3
  const [grupos, setGrupos] = useState([]);

  // Carregando grupos (requisição POST)
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);

  // ────────────────────────────────────────────────────────────
  // PASSO 1: Buscar modelos BIM do empreendimento
  // ────────────────────────────────────────────────────────────
  const { data: modelos = [], isLoading: carregandoModelos } = useQuery({
    queryKey: ['bimModelosPorEmpreendimento', empreendimentoId, organizacaoId],
    queryFn: async () => {
      if (!empreendimentoId || !organizacaoId) return [];
      const { data, error } = await supabase
        .from('projetos_bim')
        .select('id, nome_arquivo, disciplina_id, versao, status, criado_em, disciplinas_projetos(nome)')
        .eq('empreendimento_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId)
        .eq('is_lixeira', false)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empreendimentoId && !!organizacaoId,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // ────────────────────────────────────────────────────────────
  // PASSO 2: Buscar categorias do modelo selecionado
  // ────────────────────────────────────────────────────────────
  const { data: categoriasDisponiveis = [], isLoading: carregandoCategorias } = useQuery({
    queryKey: ['bimCategorias', modeloSelecionado?.id, organizacaoId],
    queryFn: async () => {
      if (!modeloSelecionado?.id) return [];
      const res = await fetch(
        `/api/orcamento/importar-bim?projeto_bim_id=${modeloSelecionado.id}&organizacao_id=${organizacaoId}`
      );
      if (!res.ok) throw new Error('Erro ao buscar categorias BIM');
      const json = await res.json();
      return json.categorias || [];
    },
    enabled: !!modeloSelecionado?.id && !!organizacaoId,
    staleTime: 2 * 60 * 1000,
  });

  // ────────────────────────────────────────────────────────────
  // PASSO 3: Carregar grupos com quantidades agrupadas
  // ────────────────────────────────────────────────────────────
  const carregarGrupos = useCallback(async () => {
    if (!modeloSelecionado?.id || categoriasSelecionadas.length === 0) return;
    setCarregandoGrupos(true);
    try {
      const res = await fetch('/api/orcamento/importar-bim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projeto_bim_id: modeloSelecionado.id,
          categorias_selecionadas: categoriasSelecionadas,
          organizacao_id: organizacaoId,
          orcamento_id: orcamentoId,
        }),
      });
      if (!res.ok) throw new Error('Erro ao carregar grupos BIM');
      const json = await res.json();
      setGrupos(json.grupos || []);
      setPasso(3);
    } catch (err) {
      toast.error('Erro ao carregar grupos: ' + err.message);
    } finally {
      setCarregandoGrupos(false);
    }
  }, [modeloSelecionado, categoriasSelecionadas, organizacaoId, orcamentoId]);

  // ────────────────────────────────────────────────────────────
  // Atualizar campo de um grupo (quantidade, preço, etapa, incluir)
  // ────────────────────────────────────────────────────────────
  const atualizarGrupo = useCallback((chave, campo, valor) => {
    setGrupos(prev =>
      prev.map(g => g.chave === chave ? { ...g, [campo]: valor } : g)
    );
  }, []);

  // ────────────────────────────────────────────────────────────
  // MUTATION FINAL: Criar itens em lote no orcamento_itens
  // ────────────────────────────────────────────────────────────
  const confirmarImportacaoMutation = useMutation({
    mutationFn: async () => {
      const gruposParaSalvar = grupos.filter(g => g.incluir && g.quantidade_editavel > 0);

      if (gruposParaSalvar.length === 0) {
        throw new Error('Selecione ao menos 1 item para importar.');
      }

      const itensParaInserir = gruposParaSalvar.map((g, index) => ({
        orcamento_id: orcamentoId,
        organizacao_id: organizacaoId,
        descricao: `${g.familia}${g.tipo && g.tipo !== 'Sem Tipo' ? ` — ${g.tipo}` : ''}`,
        quantidade: g.quantidade_editavel,
        unidade: g.unidade,
        preco_unitario: parseFloat(g.preco_unitario) || 0,
        custo_total: g.quantidade_editavel * (parseFloat(g.preco_unitario) || 0),
        etapa_id: g.etapa_id || null,
        subetapa_id: null,
        categoria: g.categoria,
        ordem: index,
        // Campos de rastreamento BIM
        origem: 'bim',
        bim_projeto_id: modeloSelecionado.id,
        bim_elemento_ids: g.external_ids,
      }));

      const { error } = await supabase
        .from('orcamento_itens')
        .insert(itensParaInserir);

      if (error) throw new Error('Erro ao salvar itens: ' + error.message);

      return itensParaInserir.length;
    },
    onSuccess: (quantidadeImportada) => {
      toast.success(`🏗️ ${quantidadeImportada} item(ns) importado(s) do BIM com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['orcamentoItens', orcamentoId] });
      resetar();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ────────────────────────────────────────────────────────────
  // Resetar todo o estado do wizard
  // ────────────────────────────────────────────────────────────
  const resetar = useCallback(() => {
    setPasso(1);
    setModeloSelecionado(null);
    setCategoriasSelecionadas([]);
    setGrupos([]);
  }, []);

  // Total estimado dos grupos selecionados
  const totalEstimado = grupos
    .filter(g => g.incluir)
    .reduce((acc, g) => acc + g.quantidade_editavel * (parseFloat(g.preco_unitario) || 0), 0);

  const gruposIncluidos = grupos.filter(g => g.incluir).length;

  return {
    // Estado do Wizard
    passo,
    setPasso,

    // Passo 1
    modelos,
    carregandoModelos,
    modeloSelecionado,
    setModeloSelecionado,

    // Passo 2
    categoriasDisponiveis,
    carregandoCategorias,
    categoriasSelecionadas,
    setCategoriasSelecionadas,
    carregarGrupos,
    carregandoGrupos,

    // Passo 3
    grupos,
    atualizarGrupo,
    totalEstimado,
    gruposIncluidos,

    // Confirmação
    confirmarImportacao: confirmarImportacaoMutation.mutate,
    confirmando: confirmarImportacaoMutation.isPending,

    // Utilitários
    resetar,
  };
}
