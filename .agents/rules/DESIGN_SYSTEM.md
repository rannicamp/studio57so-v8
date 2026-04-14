# 🎨 Elo 57 / Studio 57 — Manual Supremo de UI/UX e Design System

> Versão 2.1 — Unificada (Março 2026 — Identidade Elo 57)  
> **REGRA SUPREMA:** Este arquivo é a lei absoluta de Design e Código do sistema Elo 57. Antes de criar qualquer tela, layout, botão, ícone, tabela ou input, consulte aqui o código exato a ser copiado. Nenhuma improvisação visual é permitida.

---

## 💎 PARTE I: Filosofia e Identidade (O "Padrão Ouro")

O sistema não deve ter cara de "painel genérico antigo", mas sim de um **Studio de Gestão Sóbrio, Sólido e Elegante**.
A interface nunca deve dar sensação de "espremedura", abuse do espaçamento para deixar os componentes respirarem.

### 0. 🏷️ Identidade Visual da Marca Elo 57

**COR PRIMÁRIA DA MARCA: PRETO** (substituiu o laranja em março/2026)

| Contexto | Logo | Fundo |
|----------|------|-------|
| Fundo Branco / Claro | Logo preta | `#FFFFFF` ou `bg-white` |
| Fundo Preto / Escuro | Logo branca | `#000000` ou `bg-black` |

**Ícones PWA** (pasta `public/icons/`):
- `icon-192x192.png` e `icon-512x512.png` → fundo transparente, logo preta
- `icon-maskable-192x192.png` e `icon-maskable-512x512.png` → fundo preto com logo branca
- `theme_color` do manifest: `#000000`
- `background_color` do manifest: `#000000`

**⚠️ PROIBIDO:** usar `#F97316` (laranja) como cor principal ou de destaque da marca. O laranja foi descontinuado.

---

### 1. Paleta de Cores e Proibições
A paleta base foca em:
- **Azul Corporativo Moderno:** (`bg-blue-600` ou `bg-blue-700` padrão do sistema). *EXCLUSIVAMENTE* em cores sólidas.
- **Branco Puro:** Para cartões e áreas de leitura visando alto contraste.
- **Cinzas Leves e Frios:** (`gray-50`, `gray-100`) para fundos e divisórias.
- **Micro-interações:** Toda ação ou hover deve ter uma resposta do sistema, mas sem exageros visíveis. Um simples `hover:bg-blue-700` ou alteração no texto é o ideal.

**🚨 REGRAS DE OURO DA MODERAÇÃO VISUAL:**
1. **NUNCA USE `bg-gradient-to-...`** (Degradês são proibidos em botões ou cards principais).
2. **Cores estritas:** Nenhum Roxo, Índigo ou Teal como cor primária de fundo ou header. Use Azul.
3. **Sombreamento:** Nenhum `shadow-lg` ou `shadow-2xl` em cards simples. Use apenas `shadow-sm` natural e seco.
4. **Menus de Listagem:** Telas compostas apenas por `Cards` (Ex: Configurações) devem seguir o design limpo: Fundo cinza claro, card branco, ícone sutil de cor sólida.
5. **Estilo Minimalista Máximo:** Extratos bancários podem usar sidebar mestre-detalhe, mas novos módulos de leitura (fóruns, recados, manuais) **DEVEM usar Grid de Cards limpos**. Ao clicar, centralize o conteúdo de forma limpa, não esprema textos do lado de navegações pesadas. Inspire-se no *Mural de Recados* ou *Configurações*.

---

## 🏗️ PARTE II: Componentes Estruturais (Layout)

### 1. 🚨 PROIBIÇÃO ABSOLUTA: Cabeçalhos "Letreiros VIPs" Coloridos Gigantes
**NUNCA utilize caixas de cabeçalho coloridas enormes** (ex: `bg-blue-700 p-10 rounded-3xl` com título gigante branco). Isso já foi expressamente considerado "brega" e inadequado para o Studio 57. 
A inspiração máxima do design corporativo do painel logado é a tela de **Contatos** (`app/(main)/contatos/page.js`), que utiliza uma interface muito mais "clean" e profissional.

### 2. 🚨 PROIBIÇÃO ABSOLUTA: Cabeçalhos Pretos e "Dark Mode" Injetado
**NUNCA insira cabeçalhos pretos, fundos cinza-escuro (gray-900/gray-800) com textos brancos ou elementos no estilo "Dark Mode Premium"**. O usuário reprova categoricamente esse estilo visual alienígena ao restante do painel. Toda a interface logada deve ser predominantemente clara (White / Light Mode) e coesa.

**O QUE NÃO FAZER (CÓDIGO EXPRESSAMENTE PROIBIDO):**
```jsx
{/* ❌ NUNCA CRIE CABEÇALHOS ASSIM! O usuário ODEIA. Causa suspensão imediata de uso. */}
<header className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-gray-800 p-6 overflow-hidden relative">
  {/* Glows em fundos escuros também são sumariamente proibidos */}
  <div className="absolute top-0 left-0 w-full h-full from-emerald-900/40 via-transparent"></div>
  <h1 className="text-white drop-shadow-sm">Título em Painel Dark Mode</h1>
</header>
```

### 3. Cabeçalho de Módulo Padrão (Obrigatório)
Todas as telas e módulos do sistema devem, sem exceção, usar o modelo simples e direto de texto escuro sob o fundo padrão da página:

```jsx
<div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-3">
        <h2 className="text-3xl font-bold text-gray-800">Nome do Módulo (Ex: Contatos)</h2>
    </div>
    <p className="text-gray-500 font-medium">Descrição curta ou sutil sobre o módulo e sua função.</p>
  </div>
  <div className="flex flex-wrap gap-2 items-center">
    {/* Controles: Busca, Filtros, Exportar e o Botão Primário sempre à direita extremidade */}
  </div>
</div>
```

### 3. Cards (Mini Boards e Formulários)
Para envolver conteúdo, formulários ou itens de grid, use fundos brancos e Sombras Naturais (`shadow-sm`).
Um detalhe excelente para **páginas de listagem/configurações** é a Barra Viva Lateral indicando o tipo de seção:

```jsx
{/* Card de Configuração Clicável */}
<div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
      <FontAwesomeIcon icon={faUser} />
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-800">Título do Card</h3>
      <p className="text-xs text-gray-500 font-medium mt-0.5">Visão geral descritiva</p>
    </div>
  </div>
</div>

{/* Seção de Formulário com Faixa Indicativa */}
<div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm relative overflow-hidden">
  {/* Faixa lateral: AZUL=Principal, VERDE=Sucesso, AMARELO=Atenção */}
  <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Título da Seção de Form</h4>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Inputs aqui */}
  </div>
</div>
```

---

## ⚙️ PARTE III: Elementos Práticos (Botões, Inputs e Tabelas)

### 1. Botões de Ação Visual (Tabelas)
Existem 2 famílias de botões de ação em tabelas. Ambas não usam "nomes", apenas Ícones.

#### 🔵 FAMÍLIA A — Ícones Simples Coloridos (PADRÃO OURO)
Padrão principal do sistema para ações de linha (Ex: `ContatoList.js`). Ficam **visíveis apenas no hover** da linha.

```jsx
{/* A linha(tr) da tabela DEVE ter a classe "group" para funcionar */}
<div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
  {/* VER/EDITAR — AZUL */}
  <button className="text-blue-500 hover:text-blue-700 p-2 transition-colors"> <FontAwesomeIcon icon={faEdit} /> </button>
  {/* DUPLICAR — VERDE */}
  <button className="text-green-500 hover:text-green-700 p-2 transition-colors"> <FontAwesomeIcon icon={faCopy} /> </button>
  {/* EXCLUIR — VERMELHO */}
  <button className="text-red-500 hover:text-red-700 p-2 transition-colors"> <FontAwesomeIcon icon={faTrash} /> </button>
</div>
```

#### ⬜ FAMÍLIA B — Botões com Caixinha (Bordas)
Usado dentro de painéis de detalhe, forms e cronogramas onde o botão precisa de mais estrutura visual sozinhos.

```jsx
<button title="Editar" className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm">
  <FontAwesomeIcon icon={faEdit} size="xs" />
</button>
```

### 2. Botões Principais de Tela
Botões devem ser blocos horizontais de cor sólida.

```jsx
// PRIMÁRIO (Ex: + Novo / Salvar)
<button className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-extrabold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
  <FontAwesomeIcon icon={faPlus} /> Ação Principal
</button>

// SECUNDÁRIO (Ex: Filtros / Cancelar / Exportar)
<button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm">
  <FontAwesomeIcon icon={faFilter} className="text-gray-400" /> Filtros
</button>

// FECHAR MODAIS (X)
<button className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
  <FontAwesomeIcon icon={faTimes} size="lg" />
</button>
```

### 3. Formulários Inteligentes (Inputs)
A estética deve ser elegante, sem bordas pesadas e com labels legíveis.

```jsx
<div>
  <label htmlFor="input_id" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
    Nome do Campo
  </label>
  <input 
    id="input_id" 
    type="text" 
    placeholder="Digite aqui..." 
    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400" 
  />
</div>
```

### 4. Tabelas Padrão Ouro
> Veja a implementação referência em `/contatos/page.js`

**Classes Estruturais da Tabela:**
| Elemento | Padrão Correto |
|----------|----------------|
| Container da tabela | `bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm` |
| Cabeçalho `<th>` | `px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider` |
| Hover da linha `<tr>` | `hover:bg-blue-50/20 transition-colors group cursor-pointer` |
| Célula principal `<td>` | `px-6 py-3 font-semibold text-gray-700` |
| Célula Secundária | `text-sm text-gray-500 font-medium` |
| Células de Valor (R$) | `text-right font-bold text-gray-800` |

### 5. Tipografia Padrão
Nos títulos, use `font-bold` ou `font-extrabold`. Em tabelas e dados, prefira `text-sm font-semibold` ou `font-medium`.

- **Proibido `font-extrabold` em textos comuns.**
- **Proibido letras microscópicas:** Nunca use text-[10px] em textos corridos, APENAS tags de status caps-lockizadas e Labels de inputs!

### 6. Badges de Status (Pílulas)
```jsx
// SUCESSO / ATIVO
<span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-green-50 text-green-700 border border-green-200 uppercase">Ativo</span>

// ATENÇÃO / PENDENTE
<span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase">Pendente</span>

// ERRO / CANCELADO
<span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200 uppercase">Atrasado</span>
```

### 7. Empty States Elegantes
Um `div` clean e respeitoso quando não houver dados.
```jsx
<div className="bg-white rounded-3xl p-12 text-center border border-gray-200 w-full shadow-sm">
    <div className="w-16 h-16 bg-blue-50 rounded-full flex mx-auto items-center justify-center mb-4 text-blue-400">
        <FontAwesomeIcon icon={faBoxOpen} className="text-2xl" />
    </div>
    <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhum dado encontrado</h3>
    <p className="text-xs font-medium text-gray-500 max-w-sm mx-auto mb-4">Sua listagem está vazia ou os filtros apagaram tudo.</p>
</div>
```

---

## 📚 PARTE IV: Dicionário Único de Ícones
> **REGRA:** Cada ação tem **UM** único ícone em todo o sistema. Nunca use variações.

```javascript
import {
    // AÇÕES CRUD
    faEdit,         // ← EDITAR (Padrão único absoluto do sistema)
    faTrash,        // ← EXCLUIR
    faPlus,         // ← ADICIONAR / CRIAR
    faSave,         // ← SALVAR
    faTimes,        // ← CANCELAR / FECHAR (X)
    faCopy,         // ← DUPLICAR / COPIAR

    // VISUALIZAÇÃO
    faEye,          // ← VER DETALHES
    faEyeSlash,     // ← OCULTAR
    faSearch,       // ← BUSCAR / PESQUISAR
    faFilter,       // ← FILTRAR
    faChevronDown,  // ← EXPANDIR / DROPDOWN
    faChevronUp,    // ← RECOLHER

    // ESTADO
    faSpinner,           // ← CARREGANDO (sempre com spin={true})
    faExclamationTriangle, // ← ALERTA
    faCheckCircle,       // ← SUCESSO
} from '@fortawesome/free-solid-svg-icons';
```

**❌ Ícones terminantemente proibidos:**
- `faPen`, `faPenToSquare`, `faPencilAlt` ➔ Use apenas **`faEdit`**.
- `faTrashAlt` ➔ Use apenas **`faTrash`**.
- `faXmark` ➔ Use apenas **`faTimes`**.
