'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useMemo } from 'react';

// ─── Prioridade de escopo: família > categoria > projeto ─────────────────────
const PRIORIDADE_ESCOPO = { familia: 1, categoria: 2, projeto: 3 };

// ─── Detecta a unidade de uma medida a partir do valor label ─────────────────
function detectarUnidade(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('volume'))      return 'm³';
  if (l.includes('área') || l.includes('area')) return 'm²';
  if (l.includes('comprimento') || l.includes('length')) return 'm';
  if (l.includes('diâmetro') || l.includes('diametro')) return 'mm';
  return 'un';
}

export function useBimMapeamentos({ organizacaoId, empreendimentoId }) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // ─── Query: mapeamentos da organização ────────────────────────────────────
  const {
    data: mapeamentos = [],
    isLoading: carregandoMapeamentos,
  } = useQuery({
    queryKey: ['bim_mapeamentos', organizacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bim_mapeamentos_propriedades')
        .select(`
          id, propriedade_nome, categoria_bim, familia_bim,
          tipo_vinculo, escopo, unidade_override, criado_em,
          material:material_id ( id, nome, unidade_medida, preco_unitario, classificacao ),
          sinapi:sinapi_id   ( id, nome, descricao, unidade_medida, "Código da Composição" )
        `)
        .eq('organizacao_id', organizacaoId)
        .order('criado_em');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizacaoId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Mutation: criar mapeamento ────────────────────────────────────────────
  const { mutateAsync: criarMapeamento, isPending: criando } = useMutation({
    mutationFn: async (payload) => {
      const org = organizacaoId;
      console.log('[BimMapeamentos] Salvando:', payload);

      // 1. Remove qualquer mapeamento existente com a mesma combinação EXATA de chaves
      //    Filtra obrigatoriamente por: org + propriedade_nome + escopo + categoria + familia
      let deleteQuery = supabase
        .from('bim_mapeamentos_propriedades')
        .delete()
        .eq('organizacao_id', org)
        .eq('propriedade_nome', payload.propriedade_nome)
        .eq('escopo', payload.escopo);

      // categoria_bim: só adiciona filtro se vier preenchido no payload
      if (payload.categoria_bim != null) {
        deleteQuery = deleteQuery.eq('categoria_bim', payload.categoria_bim);
      } else {
        deleteQuery = deleteQuery.is('categoria_bim', null);
      }

      // familia_bim: só adiciona filtro se vier preenchido no payload
      if (payload.familia_bim != null) {
        deleteQuery = deleteQuery.eq('familia_bim', payload.familia_bim);
      } else {
        deleteQuery = deleteQuery.is('familia_bim', null);
      }

      const { error: delErr, count } = await deleteQuery.select('id');
      if (delErr) console.warn('[BimMapeamentos] Aviso no delete:', delErr);
      else console.log('[BimMapeamentos] Deletados antes do insert:', count ?? 'n/a');

      // 2. Insere o novo mapeamento
      const { data, error } = await supabase
        .from('bim_mapeamentos_propriedades')
        .insert({ ...payload, organizacao_id: org })
        .select()
        .single();
      if (error) {
        console.error('[BimMapeamentos] Erro no insert:', error);
        throw error;
      }
      console.log('[BimMapeamentos] Salvo com sucesso:', data?.id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bim_mapeamentos', organizacaoId] });
      queryClient.invalidateQueries({ queryKey: ['bim_quantitativos_orcamentacao'] });
    },
    onError: (err) => console.error('[useBimMapeamentos] Erro ao salvar mapeamento:', err),
  });

  // ─── Mutation: deletar mapeamento ─────────────────────────────────────────
  const { mutateAsync: deletarMapeamento, isPending: deletando } = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('bim_mapeamentos_propriedades')
        .delete()
        .eq('id', id)
        .eq('organizacao_id', organizacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bim_mapeamentos', organizacaoId] });
      queryClient.invalidateQueries({ queryKey: ['bim_quantitativos_orcamentacao'] });
    },
  });

  // ─── Mutation: atualizar fator de conversão em lote ───────────────────────
  const { mutateAsync: atualizarFatorMaterial, isPending: atualizandoFator } = useMutation({
    mutationFn: async ({ id, origem, novoFator }) => {
      let q = supabase
        .from('bim_mapeamentos_propriedades')
        .update({ fator_conversao: novoFator ? novoFator.trim() : null })
        .eq('organizacao_id', organizacaoId);
        
      if (origem === 'sinapi') {
        q = q.eq('sinapi_id', id);
      } else {
        q = q.eq('material_id', id);
      }

      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bim_mapeamentos', organizacaoId] });
      queryClient.invalidateQueries({ queryKey: ['bim_quantitativos_orcamentacao'] });
    },
  });

  // ─── Lookup rápido: dado (categoria, familia, propriedade) → mapeamento ───
  const mapeamentoPor = useMemo(() => {
    // Para cada chave, guarda o mapeamento de maior prioridade (mais específico)
    const mapa = {};
    mapeamentos.forEach(m => {
      // Gera candidatos de chave a este mapeamento
      const candidatos = [];
      if (m.escopo === 'projeto')  candidatos.push(`projeto|||${m.propriedade_nome}`);
      if (m.escopo === 'categoria') candidatos.push(`categoria|||${m.categoria_bim}|||${m.propriedade_nome}`);
      if (m.escopo === 'familia')  candidatos.push(`familia|||${m.categoria_bim}|||${m.familia_bim}|||${m.propriedade_nome}`);

      candidatos.forEach(chave => {
        const atual = mapa[chave];
        const prio = PRIORIDADE_ESCOPO[m.escopo];
        if (!atual || prio < PRIORIDADE_ESCOPO[atual.escopo]) {
          mapa[chave] = m;
        }
      });
    });
    return mapa;
  }, [mapeamentos]);

  // ─── Resolve mapeamento para um elemento + propriedade específicos ─────────
  const resolverMapeamento = (elem, propriedade) => {
    const cat = elem.categoria || '';
    const fam = elem.familia   || '';
    return (
      mapeamentoPor[`familia|||${cat}|||${fam}|||${propriedade}`] ||
      mapeamentoPor[`categoria|||${cat}|||${propriedade}`]         ||
      mapeamentoPor[`projeto|||${propriedade}`]                    ||
      null
    );
  };

  // ─── Calcular quantitativos consolidados por material ──────────────────────
  // ─── Calcular quantitativos consolidados por material (Via Banco / RPC) ────
  const { data: quantitativoPorMaterial = [], isLoading: carregandoQuantitativoPorMaterial } = useQuery({
    queryKey: ['bim_quantitativos_orcamentacao', organizacaoId, empreendimentoId],
    queryFn: async () => {
      if (!empreendimentoId || !organizacaoId) return [];
      console.log(`[BimMapeamentos] Chamando RPC get_quantitativos_orcamentacao_bim...`);
      const { data, error } = await supabase.rpc('get_quantitativos_orcamentacao_bim', {
        p_organizacao_id: organizacaoId,
        p_empreendimento_id: empreendimentoId,
      });
      if (error) {
        console.error('[BimMapeamentos] Erro na RPC:', error);
        throw error;
      }

      // Processar a matemática do fator customizado (ex: [q] / 10)
      const parseFormula = (fatorStr, valorBruto) => {
        if (!fatorStr) return valorBruto;
        try {
          const expressao = fatorStr.replace(/\[quantidade\]|\[q\]/gi, valorBruto.toString());
          // eslint-disable-next-line no-new-func
          const fn = new Function('return ' + expressao);
          const resultado = fn();
          return typeof resultado === 'number' && !isNaN(resultado) ? resultado : valorBruto;
        } catch (e) {
          console.error('[BimMapeamentos] Erro ao interpretar fator de conversao:', fatorStr, e);
          return valorBruto;
        }
      };

      const resultado = (data || []).map(item => {
        if (item.fator_conversao) {
          const original = Number(item.quantidade) || 0;
          const preco = Number(item.preco_unitario) || 0;
          const novaQuantidade = parseFormula(item.fator_conversao, original);
          return {
            ...item,
            quantidadeOriginalApenasParaInfo: original,
            quantidade: novaQuantidade,
            custo_total: novaQuantidade * preco
          };
        }
        return item;
      });

      return resultado;
    },
    enabled: !!organizacaoId && !!empreendimentoId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  // ─── Lookup: propriedades que estão mapeadas (para badge no sidebar) ───────
  const propriedadesMapeadas = useMemo(() => {
    const set = new Set();
    mapeamentos.forEach(m => set.add(m.propriedade_nome));
    return set;
  }, [mapeamentos]);

    // KPIs da aba "Orçamentação" (Por Material) ───────────────────────────
    const kpisMaterial = useMemo(() => {
      const custoTotal         = quantitativoPorMaterial.reduce((s, m) => s + m.custo_total, 0);
      const materialComAlerta  = quantitativoPorMaterial.filter(m => m.tem_alertas).length;
      const totalMapeados      = quantitativoPorMaterial.length;
      const propriedadesUsadas = mapeamentos.filter(m => m.tipo_vinculo === 'material').length;
      return { custoTotal, materialComAlerta, totalMapeados, propriedadesUsadas };
    }, [quantitativoPorMaterial, mapeamentos]);
  
    return {
      mapeamentos,
      carregandoMapeamentos,
      criarMapeamento,
      deletarMapeamento,
      criando,
      deletando,
      resolverMapeamento,
      quantitativoPorMaterial,
      carregandoQuantitativoPorMaterial,
      propriedadesMapeadas,
      kpisMaterial,
    };
  }
  
