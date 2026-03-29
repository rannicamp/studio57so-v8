# 📖 Manual Padrão Ouro: Gestão de Arquivos e Anexos (Elo 57)

Bem-vindo ao manual oficial de Gestão de Arquivos do **Studio 57**. Este documento padroniza a interface, a gestão no banco de dados e a visualização de documentos para garantir uma experiência de ponta (Padrão Ouro) em todo o ecossistema. 

---

## 🎯 1. Filosofia de Design (O "Padrão Ouro")
Antes, as abas de "Jurídico", "Marketing" ou "Projetos", possuíam listagens de arquivos descentralizadas, cada uma desenvolvida com características diferentes. 

Hoje, a **Governança de Documentos** funciona sobre um *Super Componente Global* (`GerenciadorAnexosGlobal.js`). Este componente garante:
1. **Unificação Visual:** Todas as abas são idênticas em comportamento.
2. **Visualização Nativa:** PDFs, vídeos e imagens abrem nativamente por cima do sistema, sem jogar o usuário para novas abas (reduzindo fricção).
3. **Escalabilidade Tecnológica:** O componente suporta alternar entre *Visualização Compacta* (Lista com abas e ícones textuais) para *Visualização Criativa* (Grade Responsiva com Cards e Miniaturas reais de PDF).

## 6. Design System e Padronização Visual

De acordo com o Design System Global do Studio 57 (auditado em `revisao_pre_lancamento.md`):
- **Fundos e Degradês**: Degradês (`bg-gradient-...`) e fundos coloridos excessivos (`bg-red-50 text-red-500 rounded`) são terminantemente proibidos nas listagens e ações de documentos.
- **Micro-interações de Botões (List View)**: Em listas, os botões das 7 ações devem possuir aparência minimalista: `text-gray-400`, sem bg (background), ganhando destaque colorido apenas em `hover:text-...`. (Ex: Download brilha `blue-600` no Hover, Excluir brilha `red-500` no Hover).
- **Ícones**: Empregar ícones únicos e sólidos (`faTrash` ao invés de `faTrashAlt`, `faPen` em vez de `faPenToSquare`, `faTimes` em vez de `faXmark`).
- **Toggle Mode**: O próprio `GerenciadorAnexosGlobal` possui nativamente a capacidade de alternar entre 'Lista' e 'Grid', quebrando a necessidade de criar botões externos no módulo pai para transacionar sua visualização.

---

## ⚙️ 2. A Toolbox (As 7 Ações Nativas)

Tudo dentro do Elo 57 agora carrega a *Caixa de Ferramentas de Arquivo*, representadas por um padrão rigoroso de cores e feedback (Toast UI):

| Ação | Ícone | Resumo do Comportamento |
| :--- | :---: | :--- |
| **Visualizar** | 👁️ (Azul) | Abre o arquivo no `FilePreviewModal.js` escuro. Formatos suportados: JPG, PNG, WEBP, MP4, WEBP e PDFs. |
| **Baixar** | 📥 (Cinza) | Permite o download através de nova aba/link direto. |
| **Copiar Link** | 🔗 (Cinza) | Copia o link público para a área de transferência. Excelente para enviar materiais via WhatsApp. |
| **Modo Corretor**| 👔 (Azul/Cinza)| Alterna (On/Off) a flag relacional `liberado_corretor`. |
| **Mover** | 🚚 (Índigo) | Realoca/Move documentos estruturalmente de uma Aba/Categoria/Etapa para outra sem precisar de re-upload no Storage. |
| **Editar Metadados**| ✏️ (Laranja) | Abre o modal para correção literal. Exemplo: Ajustar nome do arquivo ou adicionar descrições analíticas. |
| **Excluir** | 🗑️ (Vermelho)| Remove definitivamente do Banco e limpa lixo inútil no Supabase Storage. |

---

## 🔮 3. Renderizador Master: `FilePreviewModal.js` 

A joia da nossa coroa. O *FilePreviewModal* é nossa tela de projeção escura (*Dark Mode Drawer*). Ele adota o design premium desenvolvido originalmente na Gestão Financeira, ocupando 100% da sua vertical direita:

- O painel carrega um ambiente sombreado `bg-gray-900` com fundo desfocado. 
- PDFs carregam nativamente e de forma imersiva.
- Possui botões integrados para Baixar ou "Abrir em Nova Aba" (caso a visualização no iframe não seja ideal pela proporção da tela).

### Como garantir que seu PDF não vire Texto Curto no Viewer?
**Aviso Técnico (Supabase):** Durante uploads em massa via scripts (Node.js/Python), é OBRIGATÓRIO informar ao Supabase qual é o `contentType` do buffer (`application/pdf`, `image/jpeg`). Se ele for submetido como genérico (`application/octet-stream`), o Google Chrome não conseguirá reconhecer automaticamente dentro do iFrame, e lerá o PDF como se fosse texto corrompido (`%PDF-1.7...`). Já os uploads manuais pela interface web não sofrem deste problema, pois o `<input type="file">` injeta o tipo MIME automaticamente.

---

## 🛠️ 4. Guia e Boas Práticas de Integração (Para Devs)

Para implantar a *Gestão Ouro* em um novo Módulo (como RH, Clientes ou Tickets), você precisará instanciar o Super Componente Global na sua página Mestra.

**Exemplo Básico:**
```jsx
import GerenciadorAnexosGlobal from '@/components/shared/GerenciadorAnexosGlobal';

// Na sua renderização:
<GerenciadorAnexosGlobal 
    anexos={listaDeAnexosDoBanco} 
    tiposDocumento={tiposDocumentoParaDropdown}
    viewMode="grid" // ou 'list'
    onView={(anexo) => handleOpenPreview(anexo)} 
    onDownload={(url) => window.open(url)}
    onCopyLink={(url) => setClipboard(url)}
    onToggleCorretor={(anexo) => alternarPermissionamento(anexo)}
    onDelete={(id, path) => removerBancoEStorage(id, path)}
    onMove={(anexo) => handleOpenModalTransferencia(anexo)}
    onEdit={(anexo) => handleOpenModalEdicao(anexo)}
/>
```

Você deve injetar os Sub-Modais de Suporte em um nível superior (ex: `<FilePreviewModal />`, `<ModalTransferirAnexo />`, `<ModalEditarAnexo />`) para evitar múltiplas instâncias caso a sua tela tenha várias abas que utilizem o gerenciador.

---

## 📈 5. O Storage (Supabase Buckets)

- A relação do arquivo mora na tabela relacional (`empreendimento_anexos`, etc).
- O binário real mora no Storage Bucket (`empreendimento-anexos`).
- Evite nomes físicos de arquivo com acentuações (`ç`, `~`, `´`) ou espaços muito longos. Sanitize os uploads.
- Arquivos Excel (`.xlsx`), Word (`.docx`) ou CAD (`.dwg`) mostrarão a tela de "Formato não suportado visualmente" com um gatilho rápido para iniciar o download local.
