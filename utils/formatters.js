// utils/formatters.js

/**
 * Formata uma string de dígitos de telefone em um formato legível.
 * @param {string} phoneStr A string de telefone, contendo apenas dígitos.
 * @returns {string} O número de telefone formatado.
 */
export function formatPhoneNumber(phoneStr) {
  if (!phoneStr || typeof phoneStr !== 'string') return '';
  
  // Remove tudo que não for número para garantir a limpeza do dado
  const digitsOnly = phoneStr.replace(/\D/g, '');

  // Padrão Brasil com nono dígito: ex: 5533998410016 -> +55 (33) 99841-0016
  if (digitsOnly.startsWith('55') && digitsOnly.length === 13) {
    const ddd = digitsOnly.substring(2, 4);
    const part1 = digitsOnly.substring(4, 9);
    const part2 = digitsOnly.substring(9);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  
  // Padrão Brasil sem DDI com nono dígito: ex: 33998410016 -> (33) 99841-0016
  if (digitsOnly.length === 11) {
    const ddd = digitsOnly.substring(0, 2);
    const part1 = digitsOnly.substring(2, 7);
    const part2 = digitsOnly.substring(7);
    return `(${ddd}) ${part1}-${part2}`;
  }
  
  // Padrão Brasil telefone fixo: ex: 3332715757 -> (33) 3271-5757
  if (digitsOnly.length === 10) {
    const ddd = digitsOnly.substring(0, 2);
    const part1 = digitsOnly.substring(2, 6);
    const part2 = digitsOnly.substring(6);
    return `(${ddd}) ${part1}-${part2}`;
  }
  
  // Para outros formatos (internacionais), apenas adiciona o '+' se não tiver
  if (digitsOnly.length > 0) {
      return `+${digitsOnly}`;
  }

  // Se não se encaixar em nenhum padrão, retorna a string original ou vazia
  return phoneStr;
}