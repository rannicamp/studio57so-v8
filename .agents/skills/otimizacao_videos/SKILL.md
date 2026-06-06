---
name: "Otimizar e Formatar Vídeos para Web (FFmpeg)"
description: "Como a IA deve processar, comprimir e otimizar vídeos .mov/.mp4 pesados usando FFmpeg e realizar o upload programático silencioso via script Node.js para o Supabase."
---

# Otimização e Formatação de Vídeos para Web (Padrão Studio 57)

Esta skill descreve o processo padrão-ouro para converter vídeos pesados (gerados por agências de marketing, como `.mov` em 4K) em formatos otimizados para Web. O objetivo é nunca sacrificar a métrica de LCP (Largest Contentful Paint) no carregamento das Landing Pages, entregando a mais alta qualidade visual no menor tamanho.

## 1. Contexto e Estratégia de Uso
- **Cenário Ideal**: Ao estruturar *Hero Sections* (seções iniciais de impacto) que demandam um vídeo rodando no fundo (Background Video) ou galerias contendo material em vídeo de alta resolução.
- **Mecanismo**: A IA deve focar no uso do motor de renderização `FFmpeg` (localizado em `C:\Users\ranni\AppData\Local\Microsoft\WinGet\Packages\...` caso o PATH global ainda não esteja acessível).

## 2. Processamento Local (Conversão via FFmpeg)
Sempre converta os arquivos de marketing originais em formatos para web utilizando os parâmetros de compressão limpa. 

**Receita de Sucesso:** 
O codec deve ser obrigatoriamente `libx264`, utilizando um fator de constância `crf 26` (equilíbrio ideal), com preset de processamento `fast`. Fundamental utilizar a tag `-an` para remover a faixa de áudio caso o vídeo seja utilizado no fundo do site (isto economiza de 15 a 40% de banda do usuário, dependendo do arquivo).

```powershell
# Exemplo de comando PowerShell acionado pela IA
$ffmpeg = "C:\Users\ranni\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe"

& $ffmpeg -y -i "Y:\Caminho\Video\hero_horizontal.mov" -vcodec libx264 -crf 26 -preset fast -an "c:\Projetos\studio57so-v8\tmp\hero_otimizado.mp4"
```

## 3. Substituição e Distribuição (Supabase Storage)
**Regra de Ouro:** Não polua o banco de dados e não quebre a Landing Page injetando novos URLs a cada correção no vídeo!
O fluxo correto é criar um script temporário e injetar o vídeo **sobrescrevendo** (`upsert: true`) a mesma URL que o Frontend do Next.js já consome. Assim, você previne deploy adicional na Vercel/Netlify.

```javascript
// Exemplo de Script Node.js (tmp/upload_hero.js)
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function uploadVideos() {
  const fileBuffer = fs.readFileSync('c:\\Projetos\\studio57so-v8\\tmp\\hero_otimizado.mp4');
  
  const { data, error } = await supabase.storage
    .from('empreendimento-anexos')
    .upload('5/anexos/VIDEO_BETA_HORIZONTAL.mp4', fileBuffer, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: true // FUNDAMENTAL: Mantém o link do Front-end!
    });
}
uploadVideos();
```

## 4. O Frontend Dinâmico e Nativo
Não se deve importar `react-use` ou hooks engessados como `window.innerWidth` para determinar qual vídeo o usuário fará o download, senão ele fará o download dos dois e estourará o plano de dados dele.

Sempre use a diretiva nativa HTML5 `media=` no componente do *App Router*.

```jsx
{/* Componente Hero Inteligente */}
<video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
  {/* Smartphone: Baixa estritamente o vídeo em aspecto 9:16 */}
  <source src="URL_DO_VIDEO_VERTICAL" media="(max-width: 767px)" type="video/mp4" />
  
  {/* Computadores e TVs: Baixa estritamente o vídeo em aspecto 16:9 */}
  <source src="URL_DO_VIDEO_HORIZONTAL" media="(min-width: 768px)" type="video/mp4" />
</video>
```
