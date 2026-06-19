# Script para Otimização e Compactação de Vídeos para WhatsApp (Studio 57)
# Autor: Devonildo (Mentor Técnico do Ranniere)

$ffmpeg = "C:\Users\ranni\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
$ffprobe = "C:\Users\ranni\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffprobe.exe"

# 1. Localizar dinamicamente a pasta correta que contem os videos
$inputDir = ""
Get-ChildItem -Path "C:\Users\ranni\OneDrive" -Directory | Where-Object { $_.Name -like "S57 INCORPORA*" } | ForEach-Object {
    $path = Join-Path $_.FullName "MARKETING\VIDEOS RANNIERE"
    if (Test-Path $path) {
        $count = (Get-ChildItem -Path $path -Filter "*.mp4" -File).Count
        if ($count -gt 0) {
            $inputDir = $path
        }
    }
}

if ([string]::IsNullOrEmpty($inputDir)) {
    Write-Host "ERRO: Nao foi possivel localizar a pasta com os videos!" -ForegroundColor Red
    Exit 1
}

$outputDir = Join-Path $inputDir "whatsapp"

# Criar pasta de saída se não existir
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "Pasta de saida '$outputDir' criada com sucesso!" -ForegroundColor Green
}

# Pegar arquivos mp4
$videos = Get-ChildItem -Path $inputDir -Filter "*.mp4" -File

Write-Host "Pasta de origem localizada: $inputDir" -ForegroundColor Green
Write-Host "Iniciando a otimacao de $($videos.Count) videos..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------" -ForegroundColor Gray

$results = @()

foreach ($video in $videos) {
    $inputFile = $video.FullName
    $outputFile = Join-Path $outputDir $video.Name
    
    Write-Host "Processando: $($video.Name)" -ForegroundColor Yellow
    
    # 1. Obter a duracao do video usando ffprobe
    $durationStr = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $inputFile
    $duration = [double]$durationStr
    
    # 2. Calcular Bitrate Maximo para manter sob 9.5 MB (margem de seguranca de 10 MB)
    $targetSizeBytes = 9.5 * 1024 * 1024
    $targetSizeBits = $targetSizeBytes * 8
    
    # Reservar 128 kbps para o audio
    $audioBitrateBits = 128 * 1024
    
    # Bitrate de video ideal
    $videoBitrateBits = ($targetSizeBits / $duration) - $audioBitrateBits
    
    # Limites de seguranca para qualidade
    if ($videoBitrateBits -lt (300 * 1024)) {
        $videoBitrateBits = 300 * 1024
    }
    if ($videoBitrateBits -gt (2.5 * 1024 * 1024)) {
        $videoBitrateBits = 2.5 * 1024 * 1024
    }
    
    $maxBitrate = [math]::Floor($videoBitrateBits)
    $bufSize = [math]::Floor($maxBitrate * 1.5)
    
    Write-Host " -> Duracao: $([math]::Round($duration, 2))s | Bitrate maximo: $([math]::Round($maxBitrate / 1kb, 0)) kbps" -ForegroundColor Gray
    
    # 3. Rodar compressao FFmpeg
    # -vf "scale=720:-2" redimensiona para largura de 720px
    # -pix_fmt yuv420p garante reproducao em celulares
    # -crf 28 fator de qualidade
    & $ffmpeg -y -i $inputFile `
              -vcodec libx264 `
              -pix_fmt yuv420p `
              -crf 28 `
              -maxrate $maxBitrate `
              -bufsize $bufSize `
              -vf "scale=720:-2" `
              -acodec aac `
              -b:a 128k `
              $outputFile 2>$null
              
    # 4. Calcular resultados
    if (Test-Path $outputFile) {
        $outSize = (Get-Item $outputFile).Length
        $origSize = $video.Length
        $reduction = [math]::Round((1 - ($outSize / $origSize)) * 100, 1)
        
        Write-Host " -> Concluido! Novo tamanho: $([math]::Round($outSize / 1MB, 2)) MB (Reducao de $reduction%)" -ForegroundColor Green
        
        $obj = [PSCustomObject]@{
            Nome            = $video.Name
            Duracao         = "$([math]::Round($duration, 1))s"
            TamanhoOriginal = "$([math]::Round($origSize / 1MB, 1)) MB"
            TamanhoNovo     = "$([math]::Round($outSize / 1MB, 2)) MB"
            Reducao         = "$reduction%"
            Status          = "Sucesso"
        }
        $results += $obj
    } else {
        Write-Host " -> FALHA ao gerar arquivo de saida para $($video.Name)" -ForegroundColor Red
        $obj = [PSCustomObject]@{
            Nome            = $video.Name
            Duracao         = "$([math]::Round($duration, 1))s"
            TamanhoOriginal = "$([math]::Round($video.Length / 1MB, 1)) MB"
            TamanhoNovo     = "-"
            Reducao         = "-"
            Status          = "Falhou"
        }
        $results += $obj
    }
    Write-Host "--------------------------------------------------" -ForegroundColor Gray
}

Write-Host "`nResumo do Processamento:" -ForegroundColor Cyan
$results | Format-Table -AutoSize
