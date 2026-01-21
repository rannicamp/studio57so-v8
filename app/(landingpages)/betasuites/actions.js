// Caminho: app/(landingpages)/betasuites/actions.js
'use server';

// Importamos a inteligência central
import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLeadBeta(formData) {
  // Envia para a central e redireciona para o obrigado do Beta
  await processarLeadUniversal(
    formData, 
    '/betasuites/obrigado', 
    'Landing Page - Beta Suítes'
  );
}