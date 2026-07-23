// Caminho: app/(landingpages)/elo57/actions.js
'use server';

import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLeadElo57(formData) {
  // Chamamos o processador universal de leads forçando a organizacao_id = 2 (Studio 57)
  await processarLeadUniversal(formData, '/elo57/obrigado', 'Landing Page - Elo 57', 2);
}
