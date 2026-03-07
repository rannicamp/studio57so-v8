# Plano de Implementação: Padronização Global do Upload (UppyListUploader)

## Problema

O sistema Studio 57 possuía múltiplos padrões de upload espalhados:
- Componente `UppyGlobalUploader` com área de drag-and-drop cinza
- Componentes **inline clonados** dentro de páginas (ex: `EmpreendimentoDetails.js` tinha 200+ linhas de `AnexoUploader` próprio, ignorando o componente compartilhado)
- Dezenas de `<input type="file">` avulsos sem UX consistente

## Solução Adotada

Criação do `UppyListUploader` — um componente modal em lista onde:
1. O usuário clica em **"Novo Documento"** (botão limpo, sem área cinza poluindo a UI)
2. Seleciona um ou mais arquivos
3. Para cada arquivo, escolhe o **tipo** e escreve a **descrição** na lista
4. Clica em **"Enviar Arquivo(s)"** fora da caixa de scroll

## Componente Central

```
components/ui/UppyListUploader.js
```

**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| `bucketName` | string | Bucket do Supabase Storage |
| `folderPath` | string | Caminho da pasta dentro do bucket |
| `hideClassificacao` | bool | Se `true`, oculta o select de tipo |
| `onUploadSuccess` | function | Callback chamado após cada upload bem-sucedido com `{ path, fileName, fileSize, tipoDocumento, descricao }` |

## Arquitetura de Upload

```
Botão "Novo Documento"
    └── Abre UppyListUploader
            ├── Usuário seleciona arquivo(s)
            ├── Lista exibe cada arquivo com campo Tipo + Descrição
            ├── Botão "Enviar Arquivo(s)" (fora do scroll)
            └── onUploadSuccess(result) → componente pai insere no banco
```

## Arquitetura Complementar (Próximos Passos)

Para cobrir 100% do sistema, precisamos criar variações baseadas no mesmo protocolo Anti-Crash:
1. **`UppyAvatarUploader.js`**: Para substituição do `<ThumbnailUploader />`, avatares de RH e capas de empreendimentos (upload de imagem única, aspect-ratio específico).
2. **`UppyFileImporter.js`**: Para arquivos de processamento em lote (OFX, Retorno, CSV), onde o arquivo não vai apenas para o Storage, mas é lido massivamente pelo Dashboard.

## Regras de Integração

1. **O Uppy faz SOMENTE o upload para o Storage** — nunca insere no banco diretamente.
2. **O componente pai (página/modal)** recebe o callback e faz o `INSERT` na tabela correta.
3. O CSS do Uppy é carregado via **CDN** (tag `<link>` no JSX) para evitar crash do Next.js.
4. Usar sempre `bucketName` e `folderPath` separados — nunca concatenar o path dentro do Uppy.

## Status de Implementação

| Módulo | Arquivo | Status |
|--------|---------|--------|
| Uploader Padrão | `components/ui/UppyListUploader.js` | ✅ Criado |
| RH - Documentos | `components/rh/FichaCompletaFuncionario.js` | ✅ Feito |
| RH - Abono | `components/rh/AbonoModal.js` | ✅ Feito |
| RH - Ponto | `components/rh/PontoImporter.js` | ✅ Feito |
| RH - Contratos | `components/rh/contratos/ContratoDocumentos.js` | ✅ Feito |
| Compartilhado - Anexo | `components/shared/AnexoUploader.js` | ✅ Feito |
| Compartilhado - Galeria | `components/shared/GaleriaMarketing.js` | ✅ Feito |
| E-mail | `components/email/EmailComposeModal.js` | ✅ Feito |
| Empreendimentos | `components/empreendimentos/EmpreendimentoDetails.js` | ✅ Feito |
| Pedidos | `components/pedidos/PedidoForm.js` | ✅ Feito |
| Contratos Imóveis | `components/contratos/ContratoAnexos.js` | ✅ Feito |
| WhatsApp Template | `components/whatsapp/TemplateMessageModal.js` | ⏳ Pendente |
| RH - Avatares | `components/rh/FichaFuncionario.js` | ⏳ Pendente |
| Financeiro - Comprovantes | `components/financeiro/LancamentoForm/FormAnexos.js` | ⏳ Pendente |

## Stack Utilizada
- **Uppy v5.2.1** (via CDN para CSS, npm para JS)
- **@uppy/core**, **@uppy/dashboard**, **@uppy/xhr-upload**, **@uppy/golden-retriever**
- **Supabase Storage** como destino final
- **React** + **Next.js 15** (App Router)
