// Caminho: app/(landingpages)/refugiobraunas/actions.js
'use server';

import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLead(formData) {
  // Configuração específica do Refúgio:
  // Redireciona para /refugiobraunas/obrigado
  // A origem vem do próprio formData (input hidden no form), então não passamos o terceiro argumento fixo.
  await processarLeadUniversal(formData, '/refugiobraunas/obrigado');
}