// Caminho: app/(landingpages)/refugiobraunas/actions.js
'use server';

import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLead(formData) {
  // Passamos o 3º argumento como garantia (fallback),
  // assim fica igualzinho ao padrão do Alfa e evita erros se o input hidden falhar.
  await processarLeadUniversal(formData, '/refugiobraunas/obrigado', 'Landing Page - Refúgio Braúnas');
}