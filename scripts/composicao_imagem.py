import os
from PIL import Image, ImageDraw, ImageFilter

def composicao():
    # Caminhos dos arquivos
    artifact_dir = "C:\\Users\\ranni\\.gemini\\antigravity\\brain\\0f486cb7-8d27-4c5c-a68b-f65492d0cd3c"
    
    # Imagem A: Fundo Original (Frame do Vídeo)
    img_a_path = os.path.join(artifact_dir, "frame_opcao1.jpg")
    
    # Imagem B: Rosto Corrigido pela IA (Primeira Versão Gerada)
    img_b_path = os.path.join(artifact_dir, "reels_cover_2506_final_1782416215249.png")
    
    # Imagem de Saída (Combinada e limpa)
    img_out_path = os.path.join(artifact_dir, "reels_clean_composicao.png")
    
    print(f"Lendo Imagem A (Fundo Original): {img_a_path}")
    print(f"Lendo Imagem B (Rosto IA): {img_b_path}")
    
    if not os.path.exists(img_a_path):
        print(f"Erro: Imagem A não encontrada no caminho: {img_a_path}")
        return
    if not os.path.exists(img_b_path):
        print(f"Erro: Imagem B não encontrada no caminho: {img_b_path}")
        return
        
    # Abrir imagens
    img_a = Image.open(img_a_path).convert("RGBA")
    img_b = Image.open(img_b_path).convert("RGBA")
    
    # Garantir que a imagem B tenha o mesmo tamanho de A (1080x1920)
    if img_b.size != img_a.size:
        print(f"Redimensionando Imagem B de {img_b.size} para {img_a.size}")
        img_b = img_b.resize(img_a.size, Image.Resampling.LANCZOS)
        
    # Criar uma máscara em tons de cinza do mesmo tamanho (1080x1920)
    # Começamos com a máscara toda preta (transparente, preserva o fundo original)
    mask = Image.new("L", img_a.size, 0)
    draw = ImageDraw.Draw(mask)
    
    # Desenhar uma elipse branca no centro (opaca, preserva o rosto/corpo da IA)
    # A elipse deve cobrir o centro da imagem onde a pessoa está posicionada.
    # Coordenadas: X vai de 150 a 930 (largura central), Y vai de 250 a 1650 (altura central)
    ellipse_box = [150, 250, 930, 1650]
    draw.ellipse(ellipse_box, fill=255)
    
    # Aplicar um desfoque gaussiano bem forte na máscara para criar uma transição ultra suave nas bordas
    # Um raio de 100 pixels cria um degradê perfeito e invisível
    mask_blurred = mask.filter(ImageFilter.GaussianBlur(100))
    
    # Mesclar as duas imagens usando a máscara desfocada
    # Onde a máscara é branca (centro), fica a Imagem B (Rosto IA)
    # Onde a máscara é preta (bordas), fica a Imagem A (Fundo Original)
    img_composite = Image.composite(img_b, img_a, mask_blurred)
    
    # Salvar a imagem combinada final em formato PNG de alta qualidade
    img_composite.convert("RGB").save(img_out_path, "PNG")
    print(f"Composição criada com sucesso e salva em: {img_out_path}")

if __name__ == "__main__":
    composicao()
