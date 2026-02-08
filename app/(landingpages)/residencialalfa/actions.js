// Caminho: app/(landingpages)/residencialalfa/actions.js
'use server';

// Importa a inteligência central que já configuramos
import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLead(formData) {
  // Passa os dados e diz para onde ir depois (Página de Obrigado do Alfa)
  await processarLeadUniversal(formData, '/residencialalfa/obrigado', 'Landing Page - Residencial Alfa');
}