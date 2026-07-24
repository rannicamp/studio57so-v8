---
name: Operar Criador e Exportador de Imagens para Redes Sociais via Canvas
description: Diretrizes técnicas para criar ferramentas e páginas de design de publicações (Instagram 1080x1080, Portrait 1080x1350 e Stories 1080x1920) com exportação PNG de alta fidelidade e visualização escalável.
---

# 🎨 Padrão de Engenharia: Exportador de Imagens Sociais de Alta Fidelidade

Este manual estabelece as regras e padrões de implementação para ferramentas web de criação e exportação de criativos de marketing para redes sociais. Ele documenta as lógicas para gerar imagens nos formatos padrão do Instagram e Stories diretamente pelo navegador do usuário.

---

## 1. Mapeamento de Proporções e Formatos

Ao desenvolver telas de criação de publicações, deve-se suportar e expor as três proporções padrão de redes sociais:

| Formato | Dimensão Fiel | Proporção (Ratio) | Caso de Uso |
| :--- | :--- | :--- | :--- |
| **Quadrado (Feed/Carrossel)** | `1080 x 1080 px` | `1:1` | Feed padrão do Instagram / Facebook |
| **Retrato (Feed Portrait)** | `1080 x 1350 px` | `4:5` | Publicações verticais de alto engajamento no Feed |
| **Vertical (Stories / Reels)** | `1080 x 1920 px` | `9:16` | Stories, Capas de Reels e TikTok |

---

## 2. A "Regra de Ouro" Anti-Viewport Mismatch

### O Problema
Ao renderizar e exportar elementos HTML para imagens usando bibliotecas como `html2canvas`, se o elemento possuir classes responsivas baseadas na janela do usuário (ex: `md:text-[38px]`, `sm:p-12`), o navegador aplicará as regras de acordo com o tamanho da tela atual do usuário. Se ele estiver num celular ou notebook pequeno, a imagem exportada sairá desconfigurada (com textos minúsculos e enormes vazios brancos).

### A Solução
O container da publicação no DOM deve **sempre ter dimensões absolutas e fixas em pixels** no código CSS (ex: `w-[1080px] h-[1920px]`) e todas as suas fontes, margens e alturas devem ser declaradas em pixels fixos, sem depender de breakpoints de tela.

Para exibir a imagem inteira de forma responsiva na tela do usuário sem quebrar o layout da página, deve-se envolver a publicação em um container flex e aplicar um redimensionamento vetorial dinâmico utilizando **CSS Transform `scale()`**:

```javascript
// Exemplo de cálculo de escala responsiva no React
const [scale, setScale] = useState(0.5);

useEffect(() => {
  const updateScale = () => {
    const width = window.innerWidth;
    const availableWidth = width - 48; // margem de segurança
    setScale(Math.min(1, availableWidth / 1080)); // 1080px é a largura base
  };
  updateScale();
  window.addEventListener('resize', updateScale);
  return () => window.removeEventListener('resize', updateScale);
}, []);
```

No JSX:
```jsx
<div style={{ width: `${1080 * scale}px`, height: `${1080 * scale}px` }} className="overflow-hidden relative">
  <div 
    id="instagram-post" 
    style={{
      width: '1080px',
      height: '1080px',
      transform: `scale(${scale})`,
      transformOrigin: 'center center'
    }}
    className="absolute bg-white flex flex-col justify-between"
  >
    {/* Conteúdo estático desenhado em pixel-art */}
  </div>
</div>
```

---

## 3. Prevenção de Perda de Fontes (Next.js layout font-family)

### O Problema
Ao clonar o elemento HTML fora da árvore original do DOM para realizar a captura (para evitar capturar botões de preview ou efeitos de transform), o elemento perde a herança de estilos e fontes configuradas nos elementos superiores da árvore do Next.js (como a tag `<body>` ou wrappers de fontes do Google). A imagem PNG gerada acaba saindo com uma fonte de fallback padrão do sistema (como *Times New Roman* com serifa).

### A Solução
Deve-se declarar explicitamente a família de fontes desejada utilizando uma regra CSS global ou uma tag `<style>` injetada diretamente na rota, com a diretiva `!important`:

```jsx
<style dangerouslySetInnerHTML={{ __html: `
  #instagram-post, #instagram-post * {
    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  }
`}} />
```

---

## 4. O Algoritmo de Exportação Padrão Ouro (PNG de Alta Resolução)

Para exportar o elemento como PNG de alta resolução de forma limpa, utilize o padrão de **DOM Cloning** acoplado ao carregamento dinâmico do `html2canvas` via CDN (mantendo o bundle leve):

```javascript
const loadHtml2Canvas = () => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const handleExport = async () => {
  try {
    const html2canvas = await loadHtml2Canvas();
    const originalElement = document.getElementById('instagram-post');
    
    // 1. Clonar o elemento original
    const clone = originalElement.cloneNode(true);
    
    // 2. Resetar estilos de transformação e cantos do preview no clone
    clone.style.transform = 'none';
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '-9999px';
    clone.style.zIndex = '-9999';
    clone.style.borderRadius = '0px'; // Post de rede social é reto
    
    document.body.appendChild(clone);
    
    // Aguarda ciclo de repintura do navegador
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 3. Capturar o clone em tamanho real 1:1
    const canvas = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    
    document.body.removeChild(clone);
    
    // 4. Iniciar o download
    const link = document.createElement('a');
    link.download = 'publicacao_instagram.png';
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  } catch (err) {
    console.error('Erro na exportação:', err);
  }
};
```

*Nota: Imagens locais (ex: SVG ou PNG no diretório `/public`) não causam problemas de CORS ou contaminação de Canvas.*

---

## 5. Exportação em Lote (Carrosséis)

Para exportar múltiplos slides de um carrossel do Instagram em uma única ação, implementa-se um loop assíncrono que alterna programaticamente o estado do slide ativo, aguarda a renderização no React/Virtual DOM e gera o download sequencial das imagens:

```javascript
const handleExportAll = async () => {
  setIsExporting(true);
  const originalSlide = currentSlide;
  try {
    const html2canvas = await loadHtml2Canvas();
    
    for (let i = 0; i < SLIDES.length; i++) {
      // 1. Atualiza o estado para o slide atual
      setCurrentSlide(i);
      
      // 2. Aguarda a renderização do React e o carregamento das imagens (mínimo de 300ms)
      await new Promise((resolve) => setTimeout(resolve, 350));
      
      const originalElement = document.getElementById('instagram-post');
      if (!originalElement) continue;

      // 3. Clona e limpa elementos indesejados (como botões de navegação)
      const clone = originalElement.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '-9999px';
      
      const navButtons = clone.querySelectorAll('.nav-btn');
      navButtons.forEach(btn => btn.remove());

      document.body.appendChild(clone);
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 4. Executa a captura
      const canvas = await html2canvas(clone, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      document.body.removeChild(clone);

      // 5. Inicia o download individual
      const link = document.createElement('a');
      link.download = `publicacao_elo57_slide_${i + 1}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    }
  } catch (err) {
    console.error('Erro ao exportar todos os slides:', err);
  } finally {
    // 6. Restaura o slide original que o usuário estava visualizando
    setCurrentSlide(originalSlide);
    setIsExporting(false);
  }
};
```

