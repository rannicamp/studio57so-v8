---
description: Como criar novos Agentes ou integrações com o Gemini no projeto de forma padronizada
---

# Diretriz de Padronização para Criar Agentes/Integrações com Gemini

Sempre que o usuário solicitar a criação de uma nova feature utilizando Inteligência Artificial (Gemini API) no projeto Studio 57, você DEVE seguir as seguintes regras, sob penalidade de quebrar módulos sensíveis. Essa padronização evita erros silenciosos e modelos defasados.

## 1. Escolha Correta do Modelo
- Utilize **obrigatoriamente** o novo modelo de elite `gemini-3.1-pro-preview` para demandas que exijam máxima inteligência e precisão em workflows complexos.
- **NUNCA utilize as versões antigas `gemini-1.5-flash` ou `gemini-2.5-flash`**, pois perderemos as capacidades de pensamento avançado, grounding e workflow agêntico do 3.1.

## 2. Retorno Restrito com JSON (SchemaType)
Se o prompt exigir um retorno estruturado (JSON), **NÃO** confie apenas no comando em texto puro pedindo um objeto (ex: "Me retorne em formato JSON"). O Google Gemini possui uma funcionalidade nativa que deve ser usada para blindar a aplicação contra quebras de parsing:
- Você DEVE configurar o parâmetro `generationConfig` no model com `responseMimeType: "application/json"`.
- Você DEVE importar e utilizar `SchemaType` do pacote `@google/generative-ai` para forçar o Schema.
  
  **Exemplo Padrão Studio 57:**
  ```javascript
  import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
  
  const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
             // ... suas chaves aqui (ex: assunto, conteudo, analise)
          },
          required: [ /* chaves obrigatórias que não podem faltar */ ]
      }
  };
  
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview', generationConfig });
  ```

## 3. Feedback Visual de Erros na UI (Toasts)
- Toda e qualquer chamada ao serviço de IA (seja API Route ou Server Action) enviada pelo frontend DEVE possuir um tratamento visual (Notificação). Jamais permita que um erro fique apenas logado no console (erro silencioso).
- Utilize a biblioteca de notificações do projeto: `import { toast } from 'sonner'`.
- Envolva a Mutation/Fetch em uma Promise e chame através do método visual do Sonner para o usuário saber que "A Magia" está acontecendo sem travar:

  **Exemplo:**
  ```javascript
  const promessa = new Promise((resolve, reject) => {
      // lógica que executa o post pra api etc..
  });

  toast.promise(promessa, {
      loading: 'Processando com Inteligência Artificial...',
      success: 'Pronto!',
      error: (err) => \`Erro ao gerar: \${err.message}\`
  });
  ```
