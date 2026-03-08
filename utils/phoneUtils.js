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

    // 2. Se for número brasileiro (country_code +55 ou começa com 55)
    const isBrazilian = countryCode === '+55' || digits.startsWith('55');

    if (isBrazilian) {
        // Remove o DDI 55 se presente
        if (digits.startsWith('55')) {
            digits = digits.substring(2);
        }

        // Agora temos: DDD (2d) + número local (8 ou 9 dígitos)
        // Celular BR = 11 dígitos locais (DDD 2d + 9 + número 8d)
        // Fixo BR    = 10 dígitos locais (DDD 2d + número 8d)
        if (digits.length === 11) {
            // Tem 11 dígitos locais → é celular com 9 → remove o 9
            // O 9 fica na posição 2 (após os 2 dígitos do DDD)
            const ddd = digits.substring(0, 2);
            const noveDigito = digits[2];
            const numero = digits.substring(3); // 8 dígitos restantes

            if (noveDigito === '9') {
                // Confirmado: é o 9 de celular. Remove.
                return ddd + numero; // 10 dígitos (o que a Meta quer)
            }
        }

        // 10 dígitos (fixo) ou caso não seja o padrão esperado → retorna como está
        return digits;
    }

    // 3. Internacional: apenas dígitos limpos (sem DDI)
    // Ex: +1 (555) 123-4567 → 15551234567
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
