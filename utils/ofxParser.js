/**
 * utils/ofxParser.js
 *
 * Parser nativo de arquivos OFX (SGML e XML).
 * Suporta arquivos ISO-8859-1 (Latin-1) do BB e outros bancos brasileiros.
 */

/**
 * Converte uma string OFX potencialmente com encoding Latin-1 para UTF-8
 * Isso resolve o problema de caracteres especiais como ã, ç, ê, etc.
 */
const sanitizarTexto = (txt) => {
  if (!txt) return '';
  try {
    // Tenta decodificar entidades HTML numéricas (ex: &#195; -> Ã)
    return txt
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .trim();
  } catch {
    return txt.trim();
  }
};

/**
 * Lê o encoding declarado no header OFX.
 * Ex: ENCODING:1252  ou  CHARSET:ISO-8859-1
 */
// Função detectarCharset() abolida a favor do fallback inteligente do TextDecoder
// Detecção inteligente abolida a favor de TextDecoder com fallback.

/**
 * Extrai o valor de uma tag SGML simples dentro de um bloco.
 * Ex: <TRNAMT>-150.00  -> '-150.00'
 */
const getTag = (block, tag) => {
  // Captura valor após tag até próximo < ou quebra de linha
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const result = regex.exec(block);
  return result ? sanitizarTexto(result[1]) : null;
};

/**
 * Função principal de parsing do OFX.
 * @param {ArrayBuffer|string} fileContentOrBuffer - Conteúdo do arquivo. Se ArrayBuffer, decodifica com charset correto.
 */
export const parseOfxContent = (fileContentOrBuffer) => {
  try {
    let fileContent;

    // Se recebeu ArrayBuffer (do FileReader), tenta UTF-8 Rigoroso. Se quebrar (comum no BB/Caixa), cai para windows-1252
    if (fileContentOrBuffer instanceof ArrayBuffer) {
      try {
        fileContent = new TextDecoder('utf-8', { fatal: true }).decode(fileContentOrBuffer);
      } catch (e) {
        fileContent = new TextDecoder('windows-1252').decode(fileContentOrBuffer);
      }
    } else {
      // String direta (compatibilidade retroativa)
      fileContent = fileContentOrBuffer;
    }

    const transacoesManuais = [];
    let bankId = null;
    let acctId = null;
    const idMap = new Set();
    let index = 0;

    // 1. Extração de Metadados (BANKID e ACCTID)
    const bankIdMatch = fileContent.match(/<BANKID>([^<\r\n]+)/i);
    if (bankIdMatch?.[1]) bankId = bankIdMatch[1].trim();

    const acctIdMatch = fileContent.match(/<ACCTID>([^<\r\n]+)/i);
    if (acctIdMatch?.[1]) acctId = acctIdMatch[1].trim();

    // 2. Divide o arquivo em blocos por transação
    // Suporta SGML (sem </STMTTRN>) e XML (com </STMTTRN>)
    // Estratégia: separar por <STMTTRN> e processar cada bloco independentemente
    const blocos = fileContent.split(/<STMTTRN>/gi);
    blocos.shift(); // Remove o cabeçalho (tudo antes do primeiro <STMTTRN>)

    for (const bloco of blocos) {
      // Remove tag de fechamento se existir (XML style)
      const blocoLimpo = bloco.replace(/<\/STMTTRN>.*/gis, '');

      const valorRaw = getTag(blocoLimpo, 'TRNAMT');
      // Normaliza separador decimal: OFX pode usar . ou ,
      const valorNormalizado = valorRaw?.replace(',', '.') || '0';
      const valor = parseFloat(valorNormalizado);

      const dataStr = getTag(blocoLimpo, 'DTPOSTED')?.substring(0, 8);

      // Bloco inválido: sem data ou sem valor numérico
      if (!dataStr || dataStr.length < 8 || isNaN(valor)) continue;

      const formattedDate = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;

      let fitId = getTag(blocoLimpo, 'FITID');
      const trnType = getTag(blocoLimpo, 'TRNTYPE') || (valor < 0 ? 'DEBIT' : 'CREDIT');
      const memo = getTag(blocoLimpo, 'MEMO');
      const name = getTag(blocoLimpo, 'NAME');
      const descricao = memo || name || 'Sem descrição';

      // Garante FITID único mesmo quando o banco não fornece
      if (!fitId || fitId === '000000' || fitId === '0' || idMap.has(fitId)) {
        fitId = `GEN_${dataStr}_${valorNormalizado.replace('.', '').replace('-', '')}_${index}`;
      }
      idMap.add(fitId);

      transacoesManuais.push({
        fitid: fitId,
        data: formattedDate,
        valor: valor,                              // Negativo = Despesa, Positivo = Receita
        tipo: valor >= 0 ? 'Receita' : 'Despesa',
        tipo_ofx: trnType,
        descricao: descricao,
      });

      index++;
    }

    return {
      sucesso: true,
      metadados: { bankId, acctId },
      transacoes: transacoesManuais,
      total_lido: transacoesManuais.length
    };

  } catch (error) {
    console.error('Erro no parseOfxContent:', error);
    return {
      sucesso: false,
      erro: error.message,
      metadados: null,
      transacoes: [],
      total_lido: 0
    };
  }
};