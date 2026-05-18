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
 *  - Remove o DDI 55 temporariamente, remove o 9º dígito e repõe o 55.
 *  - Números fixos (10 dígitos locais) não são alterados.
 *
 * Números internacionais (country_code diferente de +55 ou originados da Meta):
 *  - Retornados apenas com dígitos, sem remoção de dígito.
 *
 * @param {string} rawPhone - O número como está (banco ou input do usuário)
 * @param {string} [countryCode='+55'] - Código do país (ex: '+55', '+1')
 * @param {boolean} [isFromMeta=false] - Indica se o número veio do webhook da Meta (sempre tem DDI)
 * @returns {string} Número formatado para a API da Meta
 */
export function formatarParaWhatsAppBR(rawPhone, countryCode = '+55', isFromMeta = false) {
    if (!rawPhone) return '';

    const str = String(rawPhone).trim();
    const hasExplicitPlus = str.startsWith('+');
    let digits = str.replace(/\D/g, '');

    if (!digits) return '';

    // 1. Identificar se é definitivamente um número brasileiro completo.
    // Começa com 55 e tem tamanho de fixo (12) ou celular (13).
    const isBrazilFull = digits.startsWith('55') && (digits.length === 12 || digits.length === 13);

    if (isBrazilFull) {
        const localDigits = digits.substring(2);
        
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
        return digits;
    }

    // 2. É um número internacional com '+' explícito
    if (hasExplicitPlus) {
        return digits;
    }

    // 3. Veio diretamente da Meta (o payload do webhook sempre envia o número com DDI)
    if (isFromMeta) {
        return digits;
    }

    // 4. Fallback: número inserido manualmente sem DDI (Ex: 33981826388 ou 5551234567)
    // Usa o countryCode passado como referência
    const ddiNum = (countryCode || '+55').replace('+', '');
    if (!digits.startsWith(ddiNum)) {
        return ddiNum + digits;
    }

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

    const str = String(rawPhone).trim();
    const hasExplicitPlus = str.startsWith('+');
    let digits = str.replace(/\D/g, '');
    
    if (!digits) return '';

    // Se já veio com '+' explícito, confiamos no DDI extraído
    if (hasExplicitPlus) {
        return digits;
    }

    const ddiDigits = (countryCode || '+55').replace('+', '');

    // Adiciona o DDI se o número não o contiver e tiver tamanho de número local
    if (!digits.startsWith(ddiDigits) && digits.length <= 11) {
        digits = ddiDigits + digits;
    }

    return digits;
}
