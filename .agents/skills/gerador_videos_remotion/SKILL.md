---
name: Operar Gerador de Vídeos Programáticos (Remotion)
description: Ensina a IA a orquestrar, animar e corrigir jitter de vídeos de alta conversão para Meta Ads usando Remotion, incluindo a conversão VFR para CFR via FFmpeg.
---

# 🎥 Operar Gerador de Vídeos Programáticos (Remotion)

## 📌 Contexto
Esta habilidade capacita a IA a atuar como uma produtora de vídeos automatizada para os empreendimentos da **Studio 57**. Utilizamos o framework **Remotion** para gerar lotes de vídeos verticais (1080x1920) focados em conversão para Meta Ads (Instagram/TikTok).

## 📂 Estrutura do Projeto
- O projeto de vídeos principal reside em: `C:\Projetos\editor de videos`.
- Todos os comandos do Remotion (ex: `npx remotion render`) devem ser rodados nesta pasta.
- Arquivos estáticos (fontes customizadas, áudios e vídeos convertidos) devem ser salvos na subpasta `public/` e referenciados via `staticFile("nome.ext")`.

## 🛠️ Regras de Ouro de UI/UX (Padrão Studio 57)
1. **Safe Zones Absolutas:** O TikTok e Reels sobrepõem seus botões flutuantes na tela. Sempre restrinja o contêiner central com `paddingTop: '250px'` e `paddingBottom: '450px'`.
2. **Branding e Topo:** O selo "PRÉ-LANÇAMENTO" (com os tracinhos estéticos e underline laranja `#f25a2f`) e a Logo devem ficar afixados no topo.
3. **Tipografia:** `Montserrat` para títulos e numerais de impacto, `Roboto` para textos utilitários, rótulos e timelines.
4. **Legibilidade (Gradiente de Fundo):** Sempre aplique um gradiente escurecedor (`rgba(0,0,0,0.85)` para `0.95` nas bordas e `0.3` no meio) sobre a mídia de fundo fotográfica/vídeo para garantir a legibilidade dos textos brancos.
5. **Assinatura de Tempo:** Todo vídeo deve ter exatos **15 segundos** (ou um tempo muito bem justificado e aprovado), sendo que os **3 últimos segundos** são *sagrados* e reservados para a tela preta com a logo horizontal da Studio 57 centralizada.

## ⚠️ Protocolo Anti-Trimilique (Jitter em Vídeos Mobile)
**CRÍTICO: NUNCA utilize vídeos diretamente de URL remota (`<Video src="https://supabase...">`) para o plano de fundo se a fonte for câmera de celular/drone!**
Esses vídeos geralmente são gravados em *VFR (Variable Frame Rate)* para economizar dados. O motor headless do Chromium (que o Remotion usa pra renderizar) engasga aleatoriamente, gerando trepidações e "trimiliques" violentos na imagem final do MP4.

**Plano de Ação Obrigatório (CFR All-Intra via FFmpeg - A Solução Definitiva):**
1. Baixe o vídeo original para a máquina local.
2. Use o **FFmpeg** para forçar o *CFR (Constant Frame Rate)* e, **CRITICAMENTE**, aplique a flag `-g 1` para criar um vídeo **All-Intra**. Isso transforma cada frame em um Keyframe, o que acaba 100% com os engasgos do Chromium na hora do render.
   ```powershell
   ffmpeg -i "video_original.mp4" -vf scale=1080:1920 -r 30 -c:v libx264 -preset fast -crf 18 -g 1 -c:a copy -y "video_all_intra.mp4"
   ```
3. Mova/salve o arquivo gerado na pasta `public/` do projeto Remotion.
4. No React, troque a URL pela função nativa de arquivos locais: `<Video src={staticFile("video_all_intra.mp4")} />`.

**Instruções de Prevenção (Exportação Direta do CapCut):**
Para evitar que o problema de "trimilique" aconteça desde a origem, oriente o usuário a exportar o vídeo de fundo no CapCut com as seguintes configurações:
- **Resolução:** 1080p ou 4K
- **Codec:** H.264 (NUNCA usar HEVC, pois navegadores engasgam ao ler H.265 frame a frame)
- **Formato:** MP4 (evitar MOV)
- **Taxa de quadros:** 30fps cravados

## 🎞️ Padrões de Animação e Componentes

### 1. Compilado Dinâmico (Carrossel)
Ferramenta ideal para condensar múltiplos gatilhos de venda em 15s.
- Corta-se o tempo útil (12s) em blocos de 4 segundos.
- Usa-se múltiplos componentes `<Sequence from={x} durationInFrames={120}>` para fatiar e substituir as "copys" na tela.
- **Transição Elegante:** Utilize a função `spring()` do Remotion para que os textos novos entrem na tela com um "pulinho" rápido de baixo para cima (`transform: translateY`).
- A mídia de fundo e o Header devem envolver um `<Sequence>` único contínuo (0 a 360) para não piscarem durante a troca rápida das letras.

### 2. Timeline Animada (Anúncio de Rota Geográfica)
Usado para provar a localização estratégica (hospitais, shoppings).
- **Sem Trilhos Fixos (Trackless):** A linha de rota (laranja) deve "nascer" e crescer revelando a página (`height: ${lineProgress * 100}%`). Nunca deixe o caminho cinza 100% desenhado no frame zero para não matar o efeito surpresa.
- **Ícones FontAwesome:** Use o pacote `@fortawesome/react-fontawesome`. O ícone deve ficar solto, gigante e limpo, fora das bolinhas da linha, alinhado à direita.
- **Marcadores na Linha:** Círculos finos que surgem piscando, atrelados ao delay do crescimento da linha usando `interpolate(pointProgress)`.
- Se a Timeline não usar vídeo de fundo (usar imagem estática JPEG), aplique obrigatoriamente um efeito *Ken Burns* sutil (Zoom de `1` a `1.08` na prop `transform: scale()`) amarrado aos frames totais do vídeo, para criar um dinamismo cinematográfico leve.

## 🚀 Exportação e Criação do Lote (Batch)
Quando o sistema inteiro for revisado e estiver sem erros:
1. Crie uma pasta final organizadora fora do repositório de vídeo, nomeando de forma profissional (ex: `C:\Projetos\NomeEmpreendimento-Meta-Ads`).
2. Rode uma cadeia de renderização concatenada no terminal. Force a substituição de rascunhos antigos usando o argumento explícito `-y`:
   ```powershell
   cd "C:\Projetos\editor de videos"
   npx remotion render src/remotion/index.ts Anuncio-Compilado "..\EmpreendimentoX-Meta-Ads\Compilado.mp4" -y
   npx remotion render src/remotion/index.ts Anuncio-Financeiro "..\EmpreendimentoX-Meta-Ads\Ticket.mp4" -y
   ```
