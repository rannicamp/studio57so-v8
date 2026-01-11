// utils/financeiro/formatarFiltros.js
import { format, isValid } from 'date-fns';

/**
 * PADRONIZAÇÃO BLINDADA DE FILTROS (Versão Corrigida: Liberdade Total)
 * Transforma a bagunça do frontend no formato exato que a 
 * função SQL 'financeiro_montar_where' espera.
 */
export const formatarFiltrosParaBanco = (filtros) => {
  if (!filtros) return {};

  return {
      // Clona o original para manter campos simples (searchTerm, booleans)
      ...filtros, 

      // 1. DATAS: O banco espera String YYYY-MM-DD ou null
      startDate: filtros?.startDate && isValid(new Date(filtros.startDate)) 
          ? format(new Date(filtros.startDate), 'yyyy-MM-dd') 
          : null,
      endDate: filtros?.endDate && isValid(new Date(filtros.endDate)) 
          ? format(new Date(filtros.endDate), 'yyyy-MM-dd') 
          : null,
      
      // 2. ARRAYS: O banco espera Arrays JSON
      // CORREÇÃO: Se vier vazio [], mandamos vazio [] para o banco entender "TRAZER TUDO".
      tipo: Array.isArray(filtros?.tipo) ? filtros.tipo : [],
      
      status: (filtros?.status && Array.isArray(filtros.status)) 
              ? filtros.status 
              : [], // <--- AGORA SIM! Vazio significa "Sem filtro", ou seja, "Mostre tudo!"

      contaIds: Array.isArray(filtros?.contaIds) ? filtros.contaIds : [],
      categoriaIds: Array.isArray(filtros?.categoriaIds) ? filtros.categoriaIds : [],
      empresaIds: Array.isArray(filtros?.empresaIds) ? filtros.empresaIds : [],
      empreendimentoIds: Array.isArray(filtros?.empreendimentoIds) ? filtros.empreendimentoIds : [],
      etapaIds: Array.isArray(filtros?.etapaIds) ? filtros.etapaIds : [],
      
      // 3. CAMPOS ESPECIAIS
      favorecidoId: (filtros?.favorecidoId && filtros.favorecidoId !== 'null') 
              ? filtros.favorecidoId 
              : null,
      
      // Garante string vazia se não houver busca
      searchTerm: filtros?.searchTerm || ''
  };
};