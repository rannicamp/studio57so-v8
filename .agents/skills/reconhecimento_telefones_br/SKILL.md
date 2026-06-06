---
name: Operar Reconhecimento de Telefones Brasileiros (Chave Canônica)
description: Ensina a IA a padronizar, extrair e agrupar números de telefone brasileiros (Whatsapp) ignorando +55 e o 9º dígito.
---

# ⚙️ Manual de Operação Autônoma: Extração Canônica de Telefones

## 1. Regra de Ouro (A Chave Mestra)
No Brasil, o formato de números de WhatsApp possui variações constantes de envio pelas APIs da Meta (presença ou ausência do DDI `+55` e do `9º dígito`). 
Para evitar duplicações de cadastro e garantir o pareamento perfeito de conversas e mensagens de um mesmo número, o sistema Studio 57 / Elo 57 utiliza **obrigatoriamente** o padrão **Extrator Canônico (DDD + 8 Dígitos)**.
- **Resultado Esperado e Imutável:** Uma string de exatos 10 dígitos numéricos (2 dígitos do DDD + 8 dígitos finais).

## 2. A Lógica do Motor Canônico (De Trás para Frente)
Sempre que a IA precisar validar, agrupar ou filtrar telefones no banco de dados (nas tabelas `whatsapp_conversations`, `whatsapp_messages`, `contatos` ou `telefones`), você **não deve** comparar as strings diretamente. Deve-se aplicar a seguinte lógica lendo a string de trás para frente:
1. Extrair os **8 últimos dígitos** (Este é o Core imutável do telefone).
2. Determinar a posição do DDD pulando ou não o 9º dígito com base na paridade do tamanho total do número:
   - Se o tamanho for ÍMPAR (ex: 11 ou 13 dígitos): Existe um 9º dígito intrometido. O DDD se encontra nos índices `-11` até `-9`.
   - Se o tamanho for PAR (ex: 10 ou 12 dígitos): Não há 9º dígito. O DDD se encontra nos índices `-10` até `-8`.
3. Juntar o `[DDD]` + `[8 dígitos finais]` para gerar a Chave Mestra.

## 3. Padrão Ouro de Implementação (JavaScript)
Use a função abaixo em scripts de saneamento (Node.js) ou na recuperação de dados do Front-end:

```javascript
export const getCanonicalPhone = (phone) => {
  if (!phone) return null;
  // 1. Limpa qualquer formatação, extraindo apenas números
  let digits = String(phone).replace(/[^0-9]/g, '');
  let len = digits.length;
  
  // Se for um número muito fora do padrão (estrangeiro, etc), cai no fallback
  if (len < 10) return digits; 
  
  // 2. Extrai os 8 dígitos finais de trás pra frente
  let core = digits.slice(-8); 
  
  // 3. Busca o DDD
  let ddd;
  if (len % 2 !== 0) { // Ímpares (com 9º dígito): 11, 13
      ddd = digits.slice(-11, -9);
  } else { // Pares (sem 9º dígito): 10, 12
      ddd = digits.slice(-10, -8);
  }
  
  // 4. Retorna a Chave Mestra de 10 dígitos
  return `${ddd}${core}`;
};

// ----------------------------------------------------
// EXEMPLO DE USO - FILTRAGEM INTELIGENTE (FRONTEND)
// ----------------------------------------------------
// Em vez de "query.eq('sender_id', numero_cru)", traga os dados e filtre em memória:
const canonicalTarget = getCanonicalPhone(conversaAtiva.phone_number);
const mensagensDestaConversa = todasMensagensDoContato.filter(msg => 
    getCanonicalPhone(msg.sender_id) === canonicalTarget || 
    getCanonicalPhone(msg.receiver_id) === canonicalTarget
);
```
