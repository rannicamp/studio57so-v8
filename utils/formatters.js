// utils/formatters.js

/**
 * Formata um número de telefone que já está no padrão E.164 (com código do país)
 * para uma exibição mais amigável.
 * @param {string} phoneNumber - O número de telefone em formato E.164 (ex: "5533991912291" ou "17815002711").
 * @returns {string} - O número formatado para exibição.
 */
export const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    const digitsOnly = String(phoneNumber).replace(/\D/g, '');

    // Formato EUA/Canadá (+1)
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
        return `+1 (${digitsOnly.substring(1, 4)}) ${digitsOnly.substring(4, 7)}-${digitsOnly.substring(7)}`;
    }
    
    // Formato Brasil Celular (+55)
    // Ex: 5533999998888 (13 digitos)
    if (digitsOnly.startsWith('55') && digitsOnly.length === 13) {
        return `+${digitsOnly.substring(0, 2)} (${digitsOnly.substring(2, 4)}) ${digitsOnly.substring(4, 9)}-${digitsOnly.substring(9)}`;
    }

    // Formato Brasil Fixo ou Celular Antigo (+55)
    // Ex: 553332715000 (12 digitos)
    if (digitsOnly.startsWith('55') && digitsOnly.length === 12) {
        return `+${digitsOnly.substring(0, 2)} (${digitsOnly.substring(2, 4)}) ${digitsOnly.substring(4, 8)}-${digitsOnly.substring(8)}`;
    }

    // Se não for um formato conhecido, retorna o número original com "+" se não tiver.
    return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
};