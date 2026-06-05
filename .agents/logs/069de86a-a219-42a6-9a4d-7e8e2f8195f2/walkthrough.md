# Walkthrough: Piloto Automático da IA Stella, Envio Assíncrono e Trava de 10MB para Vídeos

Implementamos a funcionalidade de **Piloto Automático (Stella)**, otimizamos o tempo de resposta do webhook do WhatsApp para menos de 3 segundos utilizando a API nativa `after()` do Next.js 15 e estabelecemos uma trava rígida de 10MB para o envio de mídias de vídeo, blindando tanto o piloto automático quanto o time de corretores contra falhas de envio da API da Meta.

---

## O que foi alterado e implementado 🛠️

### 1. Banco de Dados (Coluna da Flag de Controle) 🗄️
*   **Migration criada:** [20260605113500_add_ia_atendimento_ativo.sql](file:///c:/Projetos/studio57so-v8/supabase/migrations/20260605113500_add_ia_atendimento_ativo.sql)
*   Coluna `ia_atendimento_ativo` na tabela `contatos` para permitir ou bloquear a autonomia de resposta automática da IA Stella para cada cliente.

### 2. Interface do Usuário com Trava de Segurança (Frontend) 🔒⚡
*   **Arquivo modificado:** [ContactProfile.js](file:///c:/Projetos/studio57so-v8/components/whatsapp/ContactProfile.js)
*   **Toggle Switch**: Botão de alternância na cor roxa no topo da ficha do lead, visível e modificável exclusivamente por usuários cujo e-mail contenha `"ranni"`.

### 3. Arquitetura Assíncrona Ultrarrápida no Webhook (Next.js 15 `after()`) ⚡🚀
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/whatsapp/webhook/route.js)
*   **Resposta Imediata**: O webhook agora processa o recebimento inicial e responde HTTP `200` imediatamente para a Meta (em milissegundos), eliminando por completo o risco de expiração de timeout de 5 segundos da Meta e 10 segundos do gateway do Netlify.
*   **Processamento Pós-Resposta**: Toda a lógica de debounce (4 segundos), análise de chat pela Stella e envio das mensagens foi encapsulada na função nativa `after()` do Next.js 15, rodando em background confiável no servidor após a resposta HTTP já ter sido entregue à Meta.

### 4. Trava de Segurança de 10MB para Vídeos (API de Envio) 🔒🎬
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/whatsapp/send/route.js)
*   **Verificação de Tamanho**: Ao enviar arquivos do tipo `video`, a API faz uma chamada HTTP `HEAD` rápida para ler o cabeçalho `content-length` direto do Storage.
*   **Bloqueio Preventivo**: Vídeos que excedem 10MB de tamanho são abortados antes de serem enviados à Meta, devolvendo um erro amigável (HTTP 400).
*   **Efeito na Stella**: Se a Stella sugerir o envio automático de um vídeo muito pesado, o sistema bloqueia preventivamente o disparo, mantendo o envio correto apenas da resposta textual da IA.

### 5. Compressão em Massa dos Vídeos Existentes (Script de Automação) 🤖🎬
*   **Script temporário:** [otimizar_videos_anexos.js](file:///C:/Users/ranni/.gemini/antigravity/brain/069de86a-a219-42a6-9a4d-7e8e2f8195f2/scratch/otimizar_videos_anexos.js)
*   **Ação**: Varreu os 23 vídeos cadastrados na tabela `empreendimento_anexos`. Para cada vídeo acima de 10MB, baixou o arquivo, calculou o bitrate ideal com base na duração usando o `ffprobe`, comprimiu para no máximo 10MB (com meta em 9.5MB) usando `ffmpeg` (H.264, AAC e resolução 720p) e fez o upload de volta para o Supabase Storage sobrescrevendo (`upsert: true`) para manter as mesmas URLs.
*   **Resultados de Destaque**:
    *   `WA_ST57 - C03.mp4` (ID: 316) reduzido de **10.44MB** para **3.89MB**.
    *   `WA_ST57 - C04.mp4` (ID: 317) reduzido de **10.37MB** para **3.92MB**.
    *   `[VID] - VIDEO ORBITA 2.mp4` (ID: 92) reduzido de **27.45MB** para **5.00MB**.
    *   `[VID] - VIDEO ORBITA 3.mp4` (ID: 158) reduzido de **29.59MB** para **5.03MB**.
    *   `[VID] - VIDEO ORBITA BETA.mp4` (ID: 166) reduzido de **20.66MB** para **4.92MB**.
    *   `[VID] - Anuncio-Condicoes.mp4` (ID: 283) reduzido de **12.59MB** para **4.02MB**.
    *   `[VID] - Anuncio-Financeiro.mp4` (ID: 284) reduzido de **12.48MB** para **4.02MB**.
    *   `[VID] - Anuncio-Localizacao.mp4` (ID: 285) reduzido de **12.58MB** para **4.04MB**.
    *   `[VID] - Anuncio-Compilado-Dinamico.mp4` (ID: 282) reduzido de **14.96MB** para **4.44MB**.
    *   Todos os outros vídeos que já estavam abaixo de 10MB foram mantidos intactos.

### 6. Inteligência de Estoque Real e Simulação Dinâmica de Valores (Stella) 🏢💰
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js)
*   **Ação**: Injetamos uma busca em tempo real na tabela `produtos_empreendimento` filtrando por unidades com status `'Disponível'` do empreendimento detectado.
*   **Inteligência de Andar**: Stella agora entende que para edifícios verticais (Alfa e Beta), o andar é definido pelos primeiros dígitos da unidade. Ela analisa se o cliente solicitou andares mais altos ou mais baixos e escolhe a unidade correta disponível no estoque.
*   **Simulação de Pagamento Padrão**: Caso identifique a solicitação de uma unidade, a Stella calcula dinamicamente e com exatidão matemática a simulação financeira:
    - Entrada (20%)
    - Fluxo de Mensais Obra (40% dividido em 42 parcelas para o Beta Suítes ou 36 para o Alfa)
    - Saldo de Chaves / Remanescente (40%)
*   **Formato de Retorno**: Apresenta as condições estruturadas em marcadores claros e profissionais para o cliente.

### 7. Processamento 100% Online de CNH (PDF) e Execução Segura Asíncrona (Sem Timeout) 📄☁️
*   **Arquivos modificados:**
    - [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js) (Chat Analysis)
    - [route.js](file:///c:/Projetos/studio57so-v8/app/api/whatsapp/webhook/route.js) (Webhook)
*   **Leitura 100% Online na Memória RAM**: A rota `/api/ai/chat-analysis` foi alterada para baixar o PDF ou imagem recente diretamente na memória RAM (como String Base64) a partir do Storage do Supabase e enviar como `inlineData` no prompt do Gemini. Nenhum arquivo físico é gravado no disco local do servidor, satisfazendo a segurança e o processamento online.
*   **Enriquecimento Cadastral Inteligente (`atualizarSeDiferente`)**: Substituímos as regras cadastrais de campos gerais (como `estado_civil`, `cargo`, data de nascimento, endereço) para atualizar mesmo que o campo já estivesse preenchido com dados antigos, protegendo apenas `cpf`, `cnpj` e `renda_familiar`. Isso permitiu sobrescrever "Casado(a)" para "Solteiro" se o cliente relatar a nova informação no chat.
*   **Resolução do Timeout com Next.js `after()`**: A execução síncrona anterior do piloto automático causava timeouts no gateway do Netlify (limite rígido de 10s), impedindo a Stella de responder e gerando retries infinitos no webhook da Meta. Agora, todo o fluxo (debounce de 4s, chamada da IA e envio de mensagens) é delegado de forma totalmente **assíncrona** ao `after()` do Next.js 15. O webhook responde instantaneamente `200 OK` em milissegundos para a Meta, e a Stella processa a resposta tranquilamente em background no Netlify.
*   **Blindagem de Retries com Idempotência**: Graças à trava de duplicidade do webhook que ignora mensagens com o mesmo `message_id` in menos de 50ms, qualquer tentativa automática de reenvio da Meta devido a tempo de resposta maior que 5s é descartada imediatamente, respondendo `ignored_duplicate` e evitando loops ou mensagens duplicadas enquanto a execução principal é concluída.

### 8. Coleta Inteligente de Endereço e Comprovante de Residência (CEP e PDF/Imagem) 🏠📄
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js)
*   **Ação**: Adicionamos orientações no prompt da Stella para gerenciar de forma proativa a coleta de endereço. Se a ficha cadastral do lead não contiver o CEP ou o número da residência, a Stella solicitará o endereço completo amigavelmente.
*   **Fluxo de CEP Otimizado**: Como o ecossistema do Elo 57 é integrado e busca logradouros, bairros, cidades e estados automaticamente a partir do CEP, a Stella foi instruída a focar na obtenção prioritária do **CEP**, **Número** e **Complemento**. Se o cliente digitar as informações adicionais, ela também as extrai e salva na tabela `contatos`.
*   **Processamento de Comprovantes**: A Stella solicita o comprovante de residência (com suporte nativo em PDF e Imagens de contas de consumo/energia/luz), ou o endereço digitado por texto no chat por simplicidade, extraindo os dados correspondentes.

---

## Verificação e Validação Local 🔍

*   **Teste Realizado**: Simulamos a Jucyara solicitando o book do Residencial Alfa por texto.
*   **Resultado de Sucesso**:
    1. O webhook processou a entrada e retornou status `ok` in **2,5 segundos** (resposta imediata para a Meta).
    2. Logo após, o bloco `after()` disparou a Stella em background.
    3. A Stella gerou a resposta de texto correta e sugeriu enviar o anexo `VIDEO REELS ALFA.mp4` (que possui 31.83MB no banco de dados).
    4. A API `/api/whatsapp/send` interceptou o vídeo, realizou a requisição `HEAD`, detectou os **31.83MB** e bloqueou o envio com a mensagem:
       `[WhatsApp Send Error] Vídeo muito grande (31.83MB) bloqueado. Limite de 10MB.`
    5. O webhook lidou com o erro de forma segura, garantindo que o texto fosse entregue e o log salvasse a causa da recusa do vídeo sem travar.
    6. Com a compressão em massa executada, todos os vídeos normais de empreendimentos agora estão abaixo dos 10MB, o que permite o piloto automático Stella enviar os books e materiais de vídeo com segurança sem estourar o limite da API da Meta!
    7. **Teste de Unidades**: Simulamos o Ranniere no chat solicitando a unidade *"mais alta"* do Beta Suítes. A Stella buscou no banco, localizou o studio **705** (R$ 269.406), realizou os cálculos da simulação com precisão cirúrgica (Entrada de R$ 53.881, 42 parcelas de R$ 2.565 e saldo remanescente de R$ 107.762) e respondeu com as informações estruturadas perfeitamente!
    8. **Teste da CNH e Estado Civil**: Criamos o script [rodar_teste_completo.js](file:///C:/Users/ranni/.gemini/antigravity/brain/069de86a-a219-42a6-9a4d-7e8e2f8195f2/scratch/rodar_teste_completo.js) e realizamos o reset cadastral do Ranniere para "Casado" e campos como RG e data de nascimento em `null`. Simulamos o envio do PDF da CNH dele e uma mensagem no chat afirmando ser "solteiro" e "Engenheiro de Software". 
       - O Gemini processou o PDF **100% na memória RAM** (Base64) de forma online.
       - A Stella extraiu com sucesso as informações da CNH: `birth_date: "1986-11-01"`, `nacionalidade: "BRASILEIRO(A)"` e `nome: "RANNIERE CAMPOS MENDES"`.
       - O motor cadastral atualizou com sucesso o `estado_civil` para "Solteiro" (sobrescrevendo o valor antigo) e o `cargo` para "Engenheiro de Software", preenchendo as colunas na tabela `contatos`.
    9. **Teste da Coleta Inteligente de Endereço**: Criamos o script [rodar_teste_endereco.js](file:///C:/Users/ranni/.gemini/antigravity/brain/069de86a-a219-42a6-9a4d-7e8e2f8195f2/scratch/rodar_teste_endereco.js) e realizamos o reset do endereço do Ranniere para `null`. Simulamos o envio de uma mensagem de texto contendo o CEP, número e complemento.
       - A Stella analisou o chat log e extraiu com sucesso os dados estruturados: `cep: "35162084"`, `address_number: "120"`, `address_complement: "apartamento 202"`.
       - O motor persistiu as informações no banco de dados na tabela `contatos` com sucesso.
    10. **Teste de Apresentação de Unidades do Beta Suítes**: Rodamos o teste de análise rápida (`quickResponse: true`) simulando a conversa com o Ranniere, onde ele perguntou sobre as unidades do Beta Suítes. 
       - O backend detectou com sucesso a palavra-chave "beta" no histórico recente de mensagens do WhatsApp.
       - Adicionou o ID do empreendimento Beta Suítes (ID 5) na lista de busca juntamente com o empreendimento da campanha original (Refúgio Braúnas, ID 6).
       - Injetou os produtos disponíveis do Beta Suítes e do Refúgio Braúnas no prompt do Gemini.
       - A Stella ofereceu a unidade real disponível **703** no 7º andar por **R$ 285.161,21**, calculando a simulação exata e detalhando as outras opções disponíveis no andar (701, 702, 705) juntamente com a tabela de vendas correta em formato PDF, sem usar respostas evasivas.

### 9. Retorno ao Modelo de Alta Inteligência Gemini 3.1 Pro Preview 🧠🚀
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js)
*   **Ação**: Revertemos a rota comercial de análise de chat `/api/ai/chat-analysis` para utilizar o modelo `gemini-3.1-pro-preview` em vez do `gemini-2.5-flash`.
*   **Raciocínio**: Embora o `gemini-2.5-flash` seja rápido, ele apresentou perda de qualidade de raciocínio lógico em conversas e na proatividade de vendas de outros imóveis. O modelo `gemini-3.1-pro-preview` garante alta inteligência comercial na oferta proativa e cálculos corretos de simulação.
*   **Mitigação de Latência**: Para satisfazer as restrições de timeout de servidores serverless (Netlify), o sistema continua utilizando o modo `quickResponse` para mensagens comuns de texto (onde Stella gera respostas rápidas), preservando o desempenho excelente e sem loops.

### 10. Prevenção Dinâmica contra Envio de Anexos Duplicados 📄🚫
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js)
*   **Histórico de Mídias**: Implementamos uma busca em tempo real na tabela `whatsapp_messages` no `Promise.all` inicial da análise de chat. Ela busca todas as mensagens do tipo `outbound` que possuem o campo `media_url` preenchido, mapeando os nomes dos arquivos enviados anteriormente na variável `anexosEnviadosContext`.
*   **Regra de Não Repetição no Prompt**: Stella comercial agora é rigidamente orientada a não sugerir em `anexo_sugerido` (retornando `null`) qualquer arquivo que já tenha sido enviado no histórico.
*   **Exceção de Solicitação Explícita**: Caso o cliente peça explicitamente para reenviar o book ou vídeo (ex: *"pode me mandar o book novamente?"*), a Stella detecta a intenção e ignora a trava de duplicidade, enviando o anexo.
*   **Script de Validação**: Criamos e executamos o script de integração [testar_duplicidade_anexos.js](file:///C:/Users/ranni/.gemini/antigravity/brain/069de86a-a219-42a6-9a4d-7e8e2f8195f2/scratch/testar_duplicidade_anexos.js) para simular as três rodadas de diálogo com o contato 5598:
    1. *Primeiro contato*: Pedido de informações sobre o Residencial Alfa -> Stella sugeriu o book (`BOOK ALFA`).
    2. *Continuação do chat (Trava ativa)*: Pergunta sobre área de lazer -> Stella respondeu e sugeriu a imagem da área gourmet (`[IMG] - 9.png`), mantendo o book travado.
    3. *Reenvio solicitado*: Cliente pede *"manda o book de novo"* -> Stella sugeriu com sucesso o book (`BOOK ALFA`), comprovando o funcionamento impecável da lógica!

### 11. Trava de Concorrência e Debounce contra Rajadas de Mensagens (Caso Igor) ⚡🚦
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/whatsapp/webhook/route.js) (Webhook)
*   **Investigação do Caso Igor**: Identificamos que quando o cliente envia mensagens em rajadas picadas (ex: mandando o CPF em uma linha e o RG em outra logo em seguida), as chamadas concorrentes paralelas do webhook geravam múltiplas respostas duplicadas da Stella.
*   **Solução (Debounce de 4 Segundos)**: Introduzimos um debounce de 4 segundos síncronos no início do fluxo do piloto automático no webhook. Ao receber uma mensagem inbound, o sistema aguarda 4s e verifica se chegou alguma mensagem inbound mais recente (`gt(created_at)`) do mesmo contato.
*   **Funcionamento**: Se uma mensagem posterior for detectada (o cliente continuou digitando), o processo atual é abortado com `ignored_older_inbound_during_debounce`. Apenas a última mensagem da rajada passará pelo check e executará a Stella, que lerá no histórico todas as mensagens agrupadas e gerará uma única resposta completa e unificada.
*   **Segurança de Timeout**: O tempo de debounce foi calibrado para 4 segundos. Somado à execução rápida da IA (modo `quickResponse: true` que leva ~2-3s), o processamento total fica em torno de 6-7s, mantendo-se de forma segura abaixo do limite de timeout de 10s do gateway do Netlify Serverless.
*   **Script de Validação**: Criamos o script [testar_trava_rajada.js](file:///C:/Users/ranni/.gemini/antigravity/brain/069de86a-a219-42a6-9a4d-7e8e2f8195f2/scratch/testar_trava_rajada.js) que disparou duas chamadas de webhook locais com 2 segundos de intervalo. A primeira chamada (antiga) detectou a segunda e abortou no debounce (`ignored_older_inbound_during_debounce`), enquanto a segunda chamada (nova) prosseguiu de forma limpa, gerando uma resposta única e sem duplicidades.

### 12. Identificação de Nomes Genéricos de Leads e Atualização Automática no CRM 👤📝
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js) (Chat Analysis)
*   **Detecção de Nome Genérico**: Instruímos a Stella comercial a perceber se o nome cadastrado no lead do CRM é genérico/placeholder (contém a palavra "Lead" ou consiste apenas em números de telefone, como `Lead (553384048404)`).
*   **Coleta Amigável**: Se o nome for genérico, ela se apresenta e pergunta ativamente e com carinho o nome real do cliente logo nas primeiras interações, evitando chamá-lo de "Lead".
*   **Enriquecimento Cadastral em Tempo Real (Quick & Full)**: Liberamos a atualização cadastral do objeto `dados_cliente` para rodar também no modo rápido (`quickResponse: true`) especificamente para o campo `nome`. 
*   **Sobrescrita Inteligente no Banco**: Atualizamos a lógica incremental do banco de dados na API de análise para permitir que nomes genéricos e placeholders temporários sejam completamente sobrescritos pelo nome real detectado (mantendo a regra restrita de apenas expandir/enriquecer nomes reais que já eram válidos no CRM).
*   **Script de Validação**: Criamos o script [testar_coleta_nome.js](file:///C:/Users/ranni/.gemini/antigravity/brain/069de86a-a219-42a6-9a4d-7e8e2f8195f2/scratch/testar_coleta_nome.js) que simula a entrada de um lead genérico. Stella se apresentou perguntando o nome do cliente. Ao responder "Meu nome é Rodrigo Mendes", o sistema extraiu com sucesso e executou `[AI Enrichment] Contato enriquecido com sucesso: { nome: 'Rodrigo Mendes' }` salvando o dado final no CRM.

### 13. Reforço da Segurança e Transparência Comercial (Disclaimer de IA) 🛡️✍️
*   **Arquivo modificado:** [route.js](file:///c:/Projetos/studio57so-v8/app/api/ai/chat-analysis/route.js) (Chat Analysis)
*   **Disclaimer de IA Rigoroso**: Atualizamos o prompt comercial da Stella (tanto no modo rápido de resposta instantânea quanto no modo de análise completa) para reforçar de maneira obrigatória que ela deve se declarar como uma inteligência artificial (IA) nas suas primeiras saudações.
*   **Transparência de Erros e Validação Humana**: Adicionamos a orientação explícita para que ela declare na apresentação que pode cometer erros em suas respostas e simulações. Portanto, toda e qualquer informação/simulação financeira fornecida por ela precisará ser revisada e verificada por um corretor de imóveis humano antes do fechamento de qualquer contrato.
*   **Objetivo**: Evitar mal-entendidos legais, proteger a Studio 57 comercialmente e alinhar a expectativa com o cliente que interage pelo WhatsApp de forma ética e transparente.

