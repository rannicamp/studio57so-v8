// Caminho: app/(landingpages)/betasuites/actions.js
'use server';

// Importamos a nossa "Central de Inteligência" (que já tem Pixel, CAPI e Banco de Dados prontos)
import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLeadBeta(formData) {
  // Chamamos a função universal passando:
  // 1. Os dados do formulário
  // 2. A página de obrigado específica do Beta
  // 3. O nome da Origem para aparecer no CRM e no Facebook
  
  await processarLeadUniversal(
    formData, 
    '/betasuites/obrigado', 
    'Landing Page - Beta Suítes'
  );
}