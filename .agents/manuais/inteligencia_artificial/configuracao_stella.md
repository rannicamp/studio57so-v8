# Manual de Configuração e Operação - Stella IA

Este manual descreve em detalhes o funcionamento da **Stella IA**, a inteligência artificial residente e assistente comercial da Studio 57 integrada à plataforma Elo 57. Este documento foi projetado para que desenvolvedores, administradores de sistema e equipe técnica compreendam desde o provisionamento inicial até a operação diária das conversas e movimentações automáticas de leads no CRM.

---

## 1. Quem é a Stella no Sistema?

Diferente de um bot tradicional que apenas roda scripts em background, a Stella IA interage com a plataforma como um **usuário e funcionário legítimo**:

* **Entidade Usuário**: Ela possui um registro na tabela `public.usuarios` atrelado a um ID no Auth do Supabase. Seu e-mail de login padrão segue a chave canônica:
  `stella.org{ID_DA_ORGANIZACAO}@elo57.com.br`
* **Entidade Contato**: Ela possui um registro na tabela `public.contatos` com o tipo `Corretor`, permitindo que leads sejam atribuídos diretamente a ela no funil.
* **Entidade Funcionário**: Ela possui um registro na tabela `public.funcionarios` associado a uma empresa da organização, com CPF fictício `000.000.000-{ID_DA_ORGANIZACAO}` e cargo de `"Stella IA"`.

Este provisionamento de usuário permite que todas as ações da IA (envio de mensagens, registro de notas de CRM e movimentações de etapa) sejam logadas de forma transparente com a autoria da própria Stella.

---

## 2. Provisionamento Automático (On-Demand)

A Stella é criada automaticamente no primeiro processamento de análise de lead de uma organização. O arquivo responsável por esta orquestração é a rota da API comercial:
* [route.js (chat-analysis)](file:///c:/projetos/studio57so-v8-main/app/api/ai/chat-analysis/route.js)

### Fluxo de Criação Interna:
1. Ao analisar um contato, o sistema verifica se já existe o e-mail `stella.org{ID_DA_ORGANIZACAO}@elo57.com.br` na tabela `usuarios`.
2. Se não existir, a API cria o usuário no Auth (gerando uma senha aleatória segura), cria o contato correspondente do tipo `Corretor` e o funcionário fictício.
3. Associa as três entidades no banco de dados e retorna o ID da Stella para as operações subsequentes.

---

## 3. O Fluxo de Atendimento no WhatsApp (Piloto Automático)

A conversa autônoma da Stella com o lead no WhatsApp é orquestrada pelo webhook de recebimento de mensagens:
* [route.js (webhook)](file:///c:/projetos/studio57so-v8-main/app/api/whatsapp/webhook/route.js)

### Como o Piloto Automático é Ativado?
A Stella assume o atendimento em duas condições:
1. **Ativação Manual**: A chavinha "Piloto Automático (Stella)" está ativa (`ia_atendimento_ativo = true`) na ficha do contato no CRM.
2. **Atribuição no Rodízio**: O lead comercial é atribuído à Stella IA no funil (o campo `corretor_id` na tabela `contatos_no_funil` é igual ao ID de contato da Stella). O Webhook detecta esta atribuição na chegada da primeira resposta do cliente, liga a chave `ia_atendimento_ativo = true` no banco e ativa o piloto automático.

### Ciclo de Resposta da IA:
```
[Mensagem Inbound WhatsApp] ──> [Webhook de Mensagem]
                                     │
                        (Debounce de Segurança: 4s)
                                     │ (Verifica se cliente parou de digitar)
                                     ▼
                      [Chamada para API chat-analysis]
                                     │
                         (Consulta Dossiê e Estoque)
                                     │ (Gera resposta com Gemini 3.1 Pro)
                                     ▼
                    [Envio de Mensagem de Texto e Anexos]
                                     │
                     (Registra no CRM histórico e notas)
```

* **Debounce de 4 Segundos**: Para evitar responder mensagens picadas ou em rajada (onde o cliente manda várias frases curtas consecutivas), o webhook aguarda 4 segundos. Se uma nova mensagem inbound chegar nesse intervalo, o temporizador reinicia, processando apenas o bloco completo consolidado.

---

## 4. Piloto Automático do Funil de Vendas (CRM)

A Stella analisa o histórico da conversa e tem permissão para **mover leads de etapa** de forma totalmente autônoma.

### Como funciona a lógica de decisão:
1. A API comercial carrega dinamicamente as colunas do funil atual do lead com suas respectivas descrições (campo `descricao` em `public.colunas_funil`), que explicam as regras de negócio de *"Quem deve estar aqui"*.
2. A IA (Gemini 3.1 Pro) compara o teor do chat do cliente com as descrições e decide a etapa correspondente.
3. Se a IA decidir mover, ela retorna a chave `mover_para_coluna_id` com o ID da nova coluna e a `justificativa_movimentacao` explicando a razão (ex: *"Lead solicitou simulação financeira e passou os dados cadastrais"* ou *"Lead informou desinteresse nas chácaras"*).
4. O sistema executa o `UPDATE` na tabela `public.contatos_no_funil`.
5. Uma trigger nativa do banco de dados (`trg_registrar_movimentacao_funil`) detecta a mudança e registra a pisada de histórico na tabela `public.historico_movimentacao_funil` para alimentar os relatórios de conversão.
6. A Stella grava uma nota na timeline do CRM com a justificativa gerada.

---

## 5. Gatilhos Especiais de Transição e Intervenção Humana

Para garantir a melhor experiência comercial e evitar alucinações (respostas inventadas) ou insistência robótica, a Stella obedece aos seguintes gatilhos rígidos no prompt:

### A. Transição para `"INTERVENÇÃO HUMANA"` (UUID: `7de9b5b4-05fa-4813-82d8-7790406ee268`):
* **Falta de Dados Técnicos**: Se o cliente fizer perguntas específicas sobre infraestrutura, andares, vagas de garagem ou valores que **não constam explicitamente no Dossiê Técnico** cadastrado no Empreendimento, a Stella não chuta a informação. Ela responde simpaticamente que vai checar e move o lead para a coluna de Intervenção Humana.
* **Solicitação Direta**: A Stella avisa em seu disclaimer inicial (primeira mensagem) que o cliente pode pedir um atendente a qualquer momento. Se o cliente disser *"quero falar com um humano"*, *"chame o corretor"* ou similar, ela se despede educadamente e move o lead para Intervenção Humana.
* **Ação**: O lead na coluna de Intervenção Humana alerta a equipe de corretores humanos no painel do CRM para assumirem o chat.

### B. Transição de Volta para `"EM ATENDIMENTO"` (Active Learning):
* Quando o corretor humano acessa a sidebar de atendimento do contato, ele visualiza o bloco de Resposta Sugerida da IA e as ferramentas cognitivas:
  * **Pergunte à Stella**: Tira dúvidas rápidas de engenharia ou preço baseado no dossiê técnico.
  * **Ensine a Stella**: Permite digitar um fato novo (ex: *"O condomínio do Alfa é R$ 350,00"*).
* Quando o corretor usa o **"Ensine a Stella"**, a API comercial:
  1. Enriquecerá o campo `dossie_ia` da tabela `public.empreendimentos` integrando o novo fato de forma organizada no Markdown do dossiê.
  2. Reescreverá a resposta sugerida incluindo a informação recém-aprendida.
  3. Moverá o lead automaticamente de volta para a coluna **`"EM ATENDIMENTO"`** para a Stella reassumir a conversa no piloto automático de forma fluida.

---

## 6. Checklist de Configuração Técnica do Zero

Para colocar a Stella para rodar em uma nova organização do sistema, siga estes passos:

1. **Variável de Ambiente**:
   * Certifique-se de que a chave `GEMINI_API_KEY` está configurada no `.env` do servidor de produção (Netlify/Next.js) e de desenvolvimento local.
2. **Cadastro do Dossiê do Empreendimento**:
   * Na tabela `public.empreendimentos`, garanta que a coluna `dossie_ia` está preenchida em formato Markdown com todas as informações comerciais úteis do projeto (Localização, itens de Lazer, Vagas de garagem, taxas de condomínio, diferenciais, etc.).
3. **Descrições de Etapas do Funil**:
   * Certifique-se de que as colunas da tabela `public.colunas_funil` possuem descrições claras e regras no campo `descricao` daquela organização para guiar as decisões cognitivas de movimentação da Stella.
4. **Rodízio ou Piloto Automático**:
   * Cadastre o contato da Stella IA no rodízio comercial, ou ative manualmente o piloto automático na ficha dos contatos que deseja automatizar.
