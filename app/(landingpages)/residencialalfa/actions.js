// Caminho: app/(landingpages)/residencialalfa/actions.js
'use server';

import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLead(formData) {
  // Configuração específica do Alfa:
  // Redireciona para /residencialalfa/obrigado
  await processarLeadUniversal(formData, '/residencialalfa/obrigado');
}