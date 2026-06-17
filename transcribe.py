import os
import sys
import math
from moviepy import VideoFileClip
import speech_recognition as sr

def format_timestamp(seconds):
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"[{minutes:02d}:{secs:02d}]"

def transcrever():
    # Caminho do vídeo enviado pelo Ranniere
    video_path = r"C:\Users\ranni\OneDrive\Área de Trabalho\0617 (1)\0617 (1).mp4"
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        
    print(f"[Devonildo] Iniciando o processamento do vídeo em: {video_path}")
    
    if not os.path.exists(video_path):
        print(f"[Devonildo] Erro: O arquivo não foi encontrado no caminho: {video_path}")
        sys.exit(1)
        
    temp_audio_path = "temp_audio.wav"
    
    try:
        print("[Devonildo] Passo 1/3: Extraindo o áudio do vídeo... (isso pode levar alguns segundos)")
        # Extrair áudio usando moviepy
        clip = VideoFileClip(video_path)
        # Salva o áudio como WAV mono para melhor compatibilidade com reconhecimento de fala
        clip.audio.write_audiofile(temp_audio_path, codec='pcm_s16le', fps=16000, nbytes=2, logger=None)
        clip.close()
        print("[Devonildo] Áudio extraído com sucesso!")
        
    except Exception as e:
        print(f"[Devonildo] Erro ao extrair áudio com moviepy: {e}")
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        sys.exit(1)

    # Passo 2/3: Transcrever o áudio extraído usando SpeechRecognition
    print("[Devonildo] Passo 2/3: Iniciando transcrição com segmentação inteligente (chunks)...")
    
    recognizer = sr.Recognizer()
    
    try:
        with sr.AudioFile(temp_audio_path) as source:
            duration = source.DURATION
            print(f"[Devonildo] Duração total do áudio: {duration:.2f} segundos ({format_timestamp(duration)})")
            
            # Vamos ler em blocos de 30 segundos
            chunk_size = 30
            num_chunks = math.ceil(duration / chunk_size)
            
            transcricao_linhas = []
            
            for i in range(num_chunks):
                offset = i * chunk_size
                # Grava o chunk atual
                # Nota: a função record() avança o ponteiro, então precisamos abrir o arquivo de áudio
                # ou reposicionar o cursor de áudio.
                # Abrimos e recordamos com offset e duration para ser preciso.
                with sr.AudioFile(temp_audio_path) as s:
                    audio_chunk = recognizer.record(s, offset=offset, duration=chunk_size)
                
                timestamp = format_timestamp(offset)
                print(f"[Devonildo] Processando bloco {i+1}/{num_chunks} {timestamp}...", end="", flush=True)
                
                try:
                    # Roda o reconhecimento na API pública da Google
                    texto = recognizer.recognize_google(audio_chunk, language='pt-BR')
                    texto_formatado = f"**{timestamp}** - {texto}"
                    transcricao_linhas.append(texto_formatado)
                    print(" OK")
                except sr.UnknownValueError:
                    # Sem áudio inteligível nesse chunk
                    print(" (Silêncio/Sem fala detectada)")
                except sr.RequestError as e:
                    print(f" Erro na API: {e}")
                    transcricao_linhas.append(f"**{timestamp}** - *[Falha na transcrição deste trecho]*")
            
            print("[Devonildo] Transcrição concluída!")
            
            # Passo 3/3: Salvar em Markdown
            print("[Devonildo] Passo 3/3: Salvando transcrição no arquivo...")
            
            nome_arquivo_saida = "transcricao_0617.md"
            with open(nome_arquivo_saida, "w", encoding="utf-8") as f:
                f.write(f"# Transcrição do Vídeo: 0617 (1).mp4\n\n")
                f.write(f"**Caminho do arquivo original:** `{video_path}`\n")
                f.write(f"**Duração total:** {format_timestamp(duration)}\n\n")
                f.write("## Transcrição com Minutagem\n\n")
                
                if transcricao_linhas:
                    for linha in transcricao_linhas:
                        f.write(f"{linha}  \n\n")
                else:
                    f.write("*Nenhuma fala pôde ser identificada no áudio.*\n")
                    
            print(f"[Devonildo] Sucesso! Transcrição salva em: {nome_arquivo_saida}")
            
    except Exception as e:
        print(f"[Devonildo] Erro durante o processo de transcrição: {e}")
        
    finally:
        # Limpar arquivo temporário
        if os.path.exists(temp_audio_path):
            print("[Devonildo] Limpando arquivo de áudio temporário...")
            try:
                os.remove(temp_audio_path)
            except Exception as e:
                print(f"Erro ao remover arquivo temporário: {e}")
            print("[Devonildo] Limpeza concluída!")

if __name__ == "__main__":
    transcrever()
