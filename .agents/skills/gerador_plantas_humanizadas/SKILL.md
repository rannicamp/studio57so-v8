---
name: "Operar Gerador de Plantas Humanizadas de Luxo"
description: "Ensina a IA a preparar imagens e gerar prompts definitivos para transformar Plantas Técnicas 2D em Plantas Humanizadas hiper-realistas (Image-to-Image), lidando com vazios (shafts) e mapeamento de materiais."
---

# Operar Gerador de Plantas Humanizadas de Luxo

Esta skill deve ser ativada sempre que o usuário solicitar ajuda para transformar uma planta baixa 2D técnica em uma **Planta Humanizada** de alto luxo usando fluxos de IA "Image-to-Image" (como Nano Banana 2 ou Midjourney).

## 1. O Desafio Técnico (O Bug dos Vazios)
Modelos "Image-to-Image" são péssimos em entender a "ausência de laje". Se existe um 'X' (representando um poço de luz, shaft ou fosso de elevador), a IA costuma desenhar um piso de concreto/madeira por baixo das linhas do X em vez de deixar um buraco escuro, destruindo a leitura da planta.

**Instrução Prévia ao Usuário (Dica de Ouro):**
Antes de entregar o prompt, **obrigatoriamente** instrua o usuário a fazer o seguinte pré-processamento rápido:
*"Se a sua planta tiver marcações de Vazio/Shaft (o famoso 'X' gigante), abra a imagem original em um editor simples (Paint, Figma) e use o balde de tinta para preencher o interior desse X com PRETO SÓLIDO (#000000). Quando você mandar a imagem com os buracos já pintados de preto para a IA, ela não vai tentar botar piso lá dentro!"*

Também alerte para **remover todos os textos** da planta original antes de gerar, pois a IA destrói a tipografia. Os textos devem ser inseridos posteriormente via código HTML no Book/Site.

---

## 2. A Estratégia de Mestre (Workflow em 2 Etapas)
O segredo dos grandes escritórios de visualização arquitetônica é o **Multi-pass Generation**. Tentar forçar a IA a fazer textura e iluminação hiper-realista ao mesmo tempo em cima de linhas finas de CAD causa alucinações (entorta paredes e destrói proporções). 

O pipeline oficial do Studio 57 funciona assim:
1. **Passo 1 (Mapeamento Flat):** A IA atua apenas como um "Balde de Tinta", preenchendo as áreas com as texturas corretas (concreto, porcelanato, grama) de forma 100% plana, travando a geometria.
2. **Passo 2 (Pós-Produção/Realismo):** Pegamos a imagem gerada no Passo 1, jogamos na IA de novo (Image-to-Image) e usamos um prompt focado *apenas* em luz, sombra e reflexos.

---

## 3. Os Prompts do Pipeline de 2 Etapas

### Passo 1: O "Balde de Tinta" (Preservação Estrutural)
Use a planta em CAD limpa (sem textos e com os 'X' pintados de preto) como imagem base e rode este prompt (ajuste o `ZONE MAPPING` conforme a planta atual):

```text
ORTHOGRAPHIC 2D ARCHITECTURAL FLOOR PLAN COLORIZATION. ABSOLUTE STRICT PRESERVATION OF ORIGINAL CAD LINES, WALLS, AND GEOMETRY. DO NOT RENDER IN 3D. NO PERSPECTIVE.

YOUR ONLY TASK IS TO APPLY FLAT TEXTURES WITHIN THE EXISTING BOUNDARIES. DO NOT DISTORT, BEND, OR INVENT ANY LINES.

ZONE MAPPING & MATERIALS:
1. Massive Garage & Ramp areas: Apply a clean, flat polished concrete texture.
2. Interior Rooms (Hall, Apartments, Suites): Apply a flat, elegant concrete-style porcelain tile texture. 
3. Garden/Outside: Apply a flat green grass texture. Render piped gas cylinder enclosures as solid concrete.

LIGHTING: Use purely flat, even, shadowless architectural lighting. Maintain high contrast for the structural walls. Render on a clean white background.
```

---

### Passo 2: O "Banho de Loja" (Luz e Hiper-realismo)
Pegue a imagem perfeita que saiu do Passo 1, use-a como imagem base (Image-to-Image com "Denoising Strength" em torno de 0.35 a 0.45), e rode este prompt para dar vida à planta:

```text
POST-PROCESSING LIGHTING AND REALISM FILTER ONLY. CRITICAL RULE: You MUST strictly preserve the exact same base image, lines, layout, geometry, and ALL EXISTING TEXTURES and materials. Do NOT change the colors or types of the existing floors, walls, or objects. Do NOT warp, bend, or invent any structural lines.

YOUR ONLY TASK: Elevate the existing flat image into a high-end, luxury architectural visualization by adding light and depth.

ENHANCEMENTS TO APPLY OVER EXISTING TEXTURES:
1. Add highly realistic, cinematic warm overhead spotlighting.
2. Cast soft, highly accurate architectural shadows from the walls, cars, and furniture onto the floor to create 3D depth.
3. Give the existing concrete and porcelain floors a slight glossy, premium reflection where the light hits them.
4. Enhance the overall contrast and vibrancy to make it look like a premium real estate presentation.
```

*Variação para o Passo 2 (Dia Claro):* Se o usuário preferir uma vibe mais arejada em vez de dramática/noturna, troque a linha "cinematic warm overhead spotlighting..." por: `Add highly realistic, bright natural daylight entering the scene, creating a well-lit, clear, and airy atmosphere. Cast sharp, realistic daylight shadows.`
