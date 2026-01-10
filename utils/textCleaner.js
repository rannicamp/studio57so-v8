// utils/textCleaner.js

export function limparTextoBancario(texto) {
    if (!texto) return '';

    return texto
        // Correções comuns de Encoding (Ã£ -> ã, etc)
        .replace(/Ã¡/g, 'á').replace(/Ã/g, 'à').replace(/Ã¢/g, 'â').replace(/Ã£/g, 'ã')
        .replace(/Ã©/g, 'é').replace(/Ãª/g, 'ê')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó').replace(/Ã´/g, 'ô').replace(/Ãµ/g, 'õ')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã§/g, 'ç').replace(/Ã‡/g, 'Ç')
        
        // Inferência de Contexto (Onde tem '?' ou caracteres quebrados)
        .replace(/PAGAMENTO/g, 'PAGAMENTO') // As vezes vem certo
        .replace(/PAGTO/g, 'PAGTO')
        .replace(/TRANSF\?/g, 'TRANSF.') // Corrige "TRANSF? "
        .replace(/TRANSF\s/g, 'TRANSF. ') 
        .replace(/D?BITO/g, 'DÉBITO')
        .replace(/CR?DITO/g, 'CRÉDITO')
        .replace(/AUTOM?TICO/g, 'AUTOMÁTICO')
        .replace(/ELETR?NICO/g, 'ELETRÔNICO')
        .replace(/SERV?CO/g, 'SERVIÇO')
        .replace(/TAR?FA/g, 'TARIFA');
}