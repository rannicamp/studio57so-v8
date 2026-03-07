# Plano de Ação: Padronização Global do Design de Uploads

## Fase 0: Fundação (Concluída)
* [x] Criar componente padrão `UppyListUploader` (nova interface em lista, sem Thumb cinza).
* [x] Adicionar prop `hideClassificacao` no `UppyListUploader`.
* [x] Remover arquivo antigo `UppyGlobalUploader.js`.

## Fase 1: Módulo de RH (Concluída)
* [x] Ficha de Documentos do Funcionário (`components/rh/FichaCompletaFuncionario.js`)
* [x] Adição de Abono/Atestado (`components/rh/AbonoModal.js`) — flag `hideClassificacao`
* [x] Importador de Ponto (`components/rh/PontoImporter.js`) — flag `hideClassificacao`
* [x] Contratos de RH (`components/rh/contratos/ContratoDocumentos.js`)

## Fase 2: Componentes Compartilhados (Concluída)
* [x] `components/shared/AnexoUploader.js` — refatorado para usar `UppyListUploader`
* [x] `components/shared/GaleriaMarketing.js` — fallback de preview corrigido
* [x] `components/email/EmailComposeModal.js` — substituído `EmailAttachmentUpload` 

## Fase 3: Empreendimentos — Inline Clash (Concluída)
* [x] `components/empreendimentos/EmpreendimentoDetails.js`
  * Removidos 200+ linhas de `AnexoUploader` e `GaleriaMarketing` inline
  * Agora importa os componentes compartilhados padronizados

## Fase 4: Outros Módulos (Concluída)
* [x] `components/pedidos/PedidoForm.js` — seção de Anexos modernizada
* [x] `components/contratos/ContratoAnexos.js` — reescrito com Uppy

## Fase 5: Pendentes
* [ ] `components/whatsapp/TemplateMessageModal.js` — input file da API Meta
* [ ] `components/rh/FichaFuncionario.js` — avatar/foto do funcionário
* [ ] `components/rh/FuncionarioModal.js` — avatar/foto do funcionário
* [ ] `components/financeiro/LancamentoForm/FormAnexos.js` — comprovantes

## QA Final
- [ ] Testar fluxo de upload em Empreendimentos, Pedidos e Contratos
- [ ] Testar aba Marketing com galeria e preview
- [ ] Verificar se há outros `input type="file"` restantes na base de código
