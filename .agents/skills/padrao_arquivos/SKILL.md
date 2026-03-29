---
name: Aplicar Padrão Ouro de Arquivos
description: Passo a passo obrigatório para implantar o Gerenciador de Anexos Global do Studio 57 (Elo 57) nas telas do sistema.
---

# 🧠 Skill: Padrão Ouro de Gestão de Arquivos

Toda vez que você for implementar ou consertar listagens de arquivos, documentos, uploads de imagem ou pdf's em QUALQUER aba/novo módulo (Contratos, Projetos, RH, Terceirizados), você deve **OBRIGATORIAMENTE seguir as etapas abaixo:**

## Paradigma do Sistema (Atenção Máxima)
- **Um arquivo nunca é isolado.** Ele sempre tem as 7 ações vinculadas (👁️, 📥, 🔗, 👔, 🚚, ✏️, 🗑️).
- **Abandone Map/Lists Genéricos!** O DEV não deve fazer `.map` solto para imprimir `divs` de anexos. O ÚNICO responsável por desenhar anexos em tela é o `<GerenciadorAnexosGlobal>`.

## Instruções de Implantação (Checklist)

1. **Importação do Gerenciador Master**
   ```js
   import GerenciadorAnexosGlobal from '@/components/shared/GerenciadorAnexosGlobal';
   ```

2. **Injeção de Props no Componente Pai**
   O componente Pai (A aba ou a Drawer) precisará receber ou possuir as funções de CRUD para gerir esses arquivos:
   - `onView`: Abre o visualizador interno (você deve adicionar `<FilePreviewModal />` na tela pai).
   - `onDownload`, `onCopyLink`, `onToggleCorretor`, `onDelete`.
   - `onMove`: (Adicionar `<ModalTransferirAnexo />` na tela pai caso precise mudar categorias).
   - `onEdit`: (Adicionar `<ModalEditarAnexo />` na tela pai para atualizar nomes/descrições).

3. **MIME Types no Uploads Via Código (Supabase)**
   > **ALERTA:** Ao construir lógicas de envio (File input ou Sync Scripts), você DEVE preencher o `contentType` do `supabase.storage.upload`. Para PDFs, passe 'application/pdf'. Se você esquecer, o Supabase colocará 'application/octet-stream', e o visualizador tentará ler o PDF como um bloco de texto feio!

4. **Variáveis Injetadas:**
   Seu `GerenciadorAnexosGlobal` sempre pede `anexos={listaArray}` e `tiposDocumento={arrayDeDict}`. Nunca passe undefined, garanta defaults vacios `anexos={dados || []}`.

Quando instruído a "aplicar o padrão ouro de arquivos", simplesmente recupere as referências nos arquivos pai como `EmpreendimentoDetails.js` e replique a exata arquitetura de "states" do preview e edição para o novo módulo.
