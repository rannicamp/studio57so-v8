// Caminho: app/(landingpages)/residencialalfa/actionsCaixa.js
'use server';

import { processarLeadUniversal } from '../_actions/leadActions';

export async function salvarLeadCaixa(formData) {
  // Vamos formatar os dados extras para que apareçam organizados na mensagem do lead
  const renda = formData.get('renda');
  const fgts = formData.get('fgts') ? 'Sim' : 'Não';
  const tempoTrabalho = formData.get('tempo_trabalho') ? 'Sim' : 'Não';
  
  // Adicionamos esses detalhes ao objeto que será processado
  // A função processarLeadUniversal vai lidar com o salvamento no banco
  formData.append('mensagem_extra', `\n--- DADOS FINANCEIROS ---\nRenda Bruta: R$ ${renda}\nPossui FGTS: ${fgts}\n+3 Anos Carteira: ${tempoTrabalho}`);

  await processarLeadUniversal(
    formData, 
    '/residencialalfa/obrigado', 
    'Residencial Alfa - Simulação Caixa'
  );
}