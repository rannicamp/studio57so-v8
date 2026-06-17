import os
import sys
import json
import wave
import math
from moviepy import VideoFileClip
from vosk import Model, KaldiRecognizer

def format_srt_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"

# Dicionário de substituições para polir a fala do Vosk (que vem crua e em minúsculas)
POLISH_MAP = {
    "estudio 57": "Studio 57",
    "vestido 57": "Studio 57",
    "estúdio 57": "Studio 57",
    "residencial alfa": "Residencial Alfa",
    "corpo de bombeiros": "Corpo de Bombeiros",
    "patrimonio de afetacao": "Patrimônio de Afetação",
    "patrimônio de afetação": "Patrimônio de Afetação",
    "pre lancamento": "pré-lançamento",
    "pre-lancamento": "pré-lançamento",
    "seguranca": "segurança",
    "tres": "três",
    "334.000 e 18": "334.018",
    "334000 e 18": "334.018",
    "405.000": "405.000",
    "133.000": "133.000",
}

def polir_texto(texto):
    # Capitalizar a primeira letra do texto
    if not texto:
        return ""
    
    # Substituições de palavras específicas
    for cru, polido in POLISH_MAP.items():
        texto = texto.replace(cru, polido)
        texto = texto.replace(cru.lower(), polido)
        
    # Ajustes finos de capitalização e pontuação simples
    palavras = texto.split()
    if palavras:
        palavras[0] = palavras[0].capitalize()
    
    texto_polido = " ".join(palavras)
    
    # Adicionar pontuação rápida se terminar com certos termos
    if texto_polido.endswith("detalhe"):
        texto_polido += "."
    elif texto_polido.endswith("afetação"):
        texto_polido += "."
    elif texto_polido.endswith("rentabilidade"):
        texto_polido += "."
    
    return texto_polido

def gerar_legendas():
    video_path = r"C:\Users\ranni\OneDrive\Área de Trabalho\0617 (1)\0617 (1).mp4"
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        
    print(f"[Devonildo] Iniciando geração de legenda sincronizada para: {video_path}")
    
    if not os.path.exists(video_path):
        print(f"[Devonildo] Erro: Arquivo não encontrado em {video_path}")
        sys.exit(1)
        
    temp_audio_path = "temp_audio_srt.wav"
    
    # 1. Extrair áudio mono 16kHz WAV
    try:
        print("[Devonildo] Passo 1/4: Extraindo áudio de alta fidelidade...")
        clip = VideoFileClip(video_path)
        clip.audio.write_audiofile(temp_audio_path, codec='pcm_s16le', fps=16000, nbytes=2, ffmpeg_params=["-ac", "1"], logger=None)
        clip.close()
        print("[Devonildo] Áudio extraído com sucesso!")
    except Exception as e:
        print(f"[Devonildo] Erro na extração: {e}")
        sys.exit(1)
        
    # 2. Carregar modelo do Vosk (baixa automaticamente se necessário)
    print("[Devonildo] Passo 2/4: Carregando modelo de reconhecimento de voz em Português...")
    try:
        model = Model(lang="pt")
    except Exception as e:
        print(f"[Devonildo] Erro ao carregar ou baixar o modelo Vosk: {e}")
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        sys.exit(1)
        
    # 3. Processar áudio e obter timestamps
    print("[Devonildo] Passo 3/4: Transcrevendo com timestamps por palavra (Word Alignment)...")
    wf = wave.open(temp_audio_path, "rb")
    print(f"[Devonildo] Canais de áudio detectados: {wf.getnchannels()}, Taxa: {wf.getframerate()}Hz")
    rec = KaldiRecognizer(model, wf.getframerate())
    rec.SetWords(True)
    
    palavras_todas = []
    
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            part_result = json.loads(rec.Result())
            if 'result' in part_result:
                palavras_todas.extend(part_result['result'])
                
    part_result = json.loads(rec.FinalResult())
    if 'result' in part_result:
        palavras_todas.extend(part_result['result'])
        
    wf.close()
    
    # 4. Agrupar palavras em blocos de legenda (chunks) de forma inteligente
    print("[Devonildo] Passo 4/4: Formatando blocos de legenda SRT...")
    
    blocos_legenda = []
    bloco_atual = []
    
    limite_caracteres = 42  # Limite confortável para ler em uma linha de legenda
    limite_tempo = 3.0      # Duração máxima de cada bloco na tela (segundos)
    max_silencio = 0.8      # Se o silêncio entre palavras passar disso, quebra o bloco
    
    for palavra_info in palavras_todas:
        word = palavra_info['word']
        start = palavra_info['start']
        end = palavra_info['end']
        
        # Se for a primeira palavra do bloco
        if not bloco_atual:
            bloco_atual.append(palavra_info)
            continue
            
        # Verificar se quebra por silêncio ou por tempo ou por tamanho do texto
        tempo_inicio_bloco = bloco_atual[0]['start']
        palavra_anterior = bloco_atual[-1]
        
        texto_bloco_com_nova = " ".join([p['word'] for p in bloco_atual]) + " " + word
        
        quebra_silencio = (start - palavra_anterior['end']) > max_silencio
        quebra_tempo = (end - tempo_inicio_bloco) > limite_tempo
        quebra_tamanho = len(texto_bloco_com_nova) > limite_caracteres
        
        if quebra_silencio or quebra_tempo or quebra_tamanho:
            # Salvar o bloco anterior
            blocos_legenda.append(bloco_atual)
            # Iniciar um novo bloco
            bloco_atual = [palavra_info]
        else:
            bloco_atual.append(palavra_info)
            
    if bloco_atual:
        blocos_legenda.append(bloco_atual)
        
    # Escrever arquivo SRT
    srt_path = "legenda_0617.srt"
    with open(srt_path, "w", encoding="utf-8") as f:
        for index, bloco in enumerate(blocos_legenda, 1):
            start_time = format_srt_time(bloco[0]['start'])
            end_time = format_srt_time(bloco[-1]['end'])
            texto_bruto = " ".join([p['word'] for p in bloco])
            texto_final = polir_texto(texto_bruto)
            
            f.write(f"{index}\n")
            f.write(f"{start_time} --> {end_time}\n")
            f.write(f"{texto_final}\n\n")
            
    print(f"[Devonildo] Legenda gerada com sucesso em: {srt_path}")
    
    # Limpar áudio temporário
    if os.path.exists(temp_audio_path):
        os.remove(temp_audio_path)
    print("[Devonildo] Processo finalizado!")

if __name__ == "__main__":
    gerar_legendas()
