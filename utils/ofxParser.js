// utils/ofxParser.js

export const parseOFX = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target.result;
      try {
        // 1. Separar o Cabeçalho (Metadata) do Corpo (XML)
        // A Caixa usa OFX 1.0.2, onde o cabeçalho não é XML.
        const ofxStartIndex = content.indexOf('<OFX>');
        
        if (ofxStartIndex === -1) {
          throw new Error("Arquivo OFX inválido: Tag <OFX> não encontrada.");
        }

        // Pega apenas a parte XML
        let xmlContent = content.substring(ofxStartIndex);

        // 2. Higienização para "XML Like" (Correção de SGML para XML)
        // Alguns bancos não fecham tags em versões antigas, mas a Caixa geralmente fecha.
        // O problema maior são caracteres especiais soltos como '&'.
        xmlContent = xmlContent
          .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;') // Escapa & soltos
          // Remove caracteres nulos ou inválidos que bancos antigos inserem
          .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, ''); 

        // 3. Parser Nativo do Browser (DOMParser)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
          console.error("Erro XML:", parserError.textContent);
          throw new Error("Falha ao processar a estrutura XML do arquivo.");
        }

        // 4. Extração de Dados
        const transactions = [];
        const bankId = getNodeValue(xmlDoc, "BANKID") || "000"; // Ex: 0104 (Caixa)
        const acctId = getNodeValue(xmlDoc, "ACCTID") || "0000"; // Conta
        
        const transactionNodes = xmlDoc.getElementsByTagName("STMTTRN");

        for (let i = 0; i < transactionNodes.length; i++) {
          const trn = transactionNodes[i];
          
          const tipo = getNodeValue(trn, "TRNTYPE"); // CREDIT ou DEBIT
          const dataRaw = getNodeValue(trn, "DTPOSTED"); // 20251210030000.000
          const valorRaw = getNodeValue(trn, "TRNAMT"); // 12910.0 ou -12870.0
          const fitid = getNodeValue(trn, "FITID"); // ID único da transação
          const memo = getNodeValue(trn, "MEMO") || getNodeValue(trn, "NAME"); // Descrição

          // Normalização de Dados
          transactions.push({
            id: fitid, // ID Único para conciliação
            data: parseOfxDate(dataRaw), // Data ISO
            descricao: memo,
            valor: parseFloat(valorRaw), // Numérico
            tipo: tipo, // CREDIT/DEBIT
            banco_id: bankId,
            conta_id: acctId,
            conciliado: false // Padrão
          });
        }

        resolve(transactions);

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (err) => reject(err);
    
    // Leitura como Text (Windows-1252 é o padrão OFX, mas UTF-8 costuma ler bem números/datas)
    // Se tiver problemas com acentos (Ex: CRÉDITO), mudar para 'ISO-8859-1'
    reader.readAsText(file, 'ISO-8859-1');
  });
};

// --- Helpers ---

// Pega valor de tag XML de forma segura
const getNodeValue = (parent, tagName) => {
  const node = parent.getElementsByTagName(tagName)[0];
  return node ? node.textContent.trim() : null;
};

// Converte data OFX (YYYYMMDDHHMMSS) para ISO (YYYY-MM-DD)
const parseOfxDate = (dateString) => {
  if (!dateString || dateString.length < 8) return new Date().toISOString();
  
  // Extrai YYYY, MM, DD
  const y = dateString.substring(0, 4);
  const m = dateString.substring(4, 6);
  const d = dateString.substring(6, 8);
  
  return `${y}-${m}-${d}`;
};