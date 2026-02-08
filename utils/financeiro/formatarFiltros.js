// utils/financeiro/formatarFiltros.js
import { format, isValid, parseISO } from 'date-fns';

/**
 * PADRONIZAÇÃO BLINDADA DE FILTROS (Versão Data Absoluta)
 * Impede que o fuso horário altere o dia selecionado.
 */
export const formatarFiltrosParaBanco = (filtros) => {
  if (!filtros) return {};

  // Função auxiliar para garantir Data String (YYYY-MM-DD) sem converter fuso
  const fixDate = (dateInput) => {
      if (!dateInput) return null;
      
      // Se já for uma string no formato YYYY-MM-DD (comum em inputs type="date"), usa ela direto!
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          return dateInput;
      }

      // Se for objeto Date ou ISO string com hora, aí sim formatamos
      const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isValid(dateObj)) {
          return format(dateObj, 'yyyy-MM-dd');
      }
      return null;
  };

  return {
      ...filtros, 

      // 1. DATAS: Usa a função blindada
      startDate: fixDate(filtros.startDate),
      endDate: fixDate(filtros.endDate),
      
      // 2. ARRAYS: Garante arrays vazios se null
      tipo: Array.isArray(filtros?.tipo) ? filtros.tipo : [],
      status: (filtros?.status && Array.isArray(filtros.status)) ? filtros.status : [],
      contaIds: Array.isArray(filtros?.contaIds) ? filtros.contaIds : [],
      categoriaIds: Array.isArray(filtros?.categoriaIds) ? filtros.categoriaIds : [],
      empresaIds: Array.isArray(filtros?.empresaIds) ? filtros.empresaIds : [],
      empreendimentoIds: Array.isArray(filtros?.empreendimentoIds) ? filtros.empreendimentoIds : [],
      etapaIds: Array.isArray(filtros?.etapaIds) ? filtros.etapaIds : [],
      
      // 3. Campos Especiais
      searchTerm: filtros?.searchTerm || '',
      favorecidoId: filtros?.favorecidoId || null,
      useCompetencia: !!filtros?.useCompetencia,
      ignoreTransfers: !!filtros?.ignoreTransfers,
      ignoreChargebacks: !!filtros?.ignoreChargebacks
  };
};