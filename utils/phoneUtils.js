// utils/phoneUtils.js
// ============================================================
// UTILITÁRIO CENTRALIZADO DE FORMATAÇÃO DE TELEFONES
// Regra de Ouro: o banco salva completo (com DDI e 9).
//                a API da Meta recebe sem DDI e sem o 9.
// ============================================================

/**
 * Formata um número para envio via API da Meta (WhatsApp).
 *
 * Regras para números BR (+55):
 *  - Remove o DDI 55
 *  - Remove o 9º dígito de celulares (quando DDD 2d + 9 + 8d = 11 dígitos locais)
 *  - Números fixos (10 dígitos locais) não são alterados
 *
 * Números internacionais (country_code diferente de +55) são
 * retornados apenas com dígitos, sem remoção de dígito.
 *
 * @param {string} rawPhone - O número como está (banco ou input do usuário)
 * @param {string} [countryCode='+55'] - Código do país (ex: '+55', '+1')
 * @returns {string} Número formatado para a API da Meta
 */
export function formatarParaWhatsAppBR(rawPhone, countryCode = '+55') {
    if (!rawPhone) return '';

    // 1. Remove tudo que não for dígito
    let digits = String(rawPhone).replace(/\D/g, '');

    if (!digits) return '';

    // Adiciona o DDI temporariamente se estiver faltando para a formatação
    const ddiNum = countryCode.replace('+', '');
    if (!digits.startsWith(ddiNum) && isBrazilian(countryCode, digits)) {
         digits = ddiNum + digits;
    }

    // 2. Se for número brasileiro (+55)
    function isBrazilian(cc, dig) {
        return cc === '+55' || dig.startsWith('55') || (dig.length >= 10 && dig.length <= 11 && cc === '+55');
    }

    if (isBrazilian(countryCode, digits) || digits.startsWith('55')) {
        // Garante que tem o 55
        if (!digits.startsWith('55')) {
            digits = '55' + digits;
        }

        const localDigits = digits.substring(2);

        // Agora temos o número local após o 55
        // Celular BR = 11 dígitos locais (DDD 2d + 9 + número 8d)
        if (localDigits.length === 11) {
            const ddd = localDigits.substring(0, 2);
            const noveDigito = localDigits[2];
            const numero = localDigits.substring(3); // 8 dígitos restantes

            if (noveDigito === '9') {
                // Remove o 9, MAS MANTÉM O 55 e o DDD
                return '55' + ddd + numero; // 12 dígitos total (o que a Meta Oficial quer)
            }
        }

        // Se tiver 10 dígitos locais (fixo) ou já estiver com 8 dígitos (sem o 9)
        return '55' + localDigits;
    }

    // 3. Internacional: retorna como está (esperando que já tenha o DDI)
    return digits;
}

/**
 * Formata um número para armazenamento no banco de dados.
 * Garante que o número tenha o DDI completo (sem máscara).
 *
 * @param {string} rawPhone - O número como digitado pelo usuário (pode ter máscara)
 * @param {string} [countryCode='+55'] - Código do país
 * @returns {string} Número limpo com DDI para salvar no banco
 */
export function formatarParaStorageBR(rawPhone, countryCode = '+55') {
    if (!rawPhone) return '';

    let digits = String(rawPhone).replace(/\D/g, '');
    if (!digits) return '';

    const ddiDigits = (countryCode || '+55').replace('+', '');

    // Adiciona o DDI se ainda não estiver presente
    if (!digits.startsWith(ddiDigits)) {
        digits = ddiDigits + digits;
    }

    return digits;
}
