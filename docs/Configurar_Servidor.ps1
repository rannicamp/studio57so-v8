Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "🔧 OTIMIZACAO DO SERVIDOR - STUDIO 57 🔧" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Energia
Write-Host "`n[1/3] Configurando Energia para NUNCA DORMIR..." -ForegroundColor Yellow
powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 
powercfg /change standby-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /h off
Write-Host "✅ Energia configurada. O Servidor agora e uma coruja (nunca dorme)!" -ForegroundColor Green

# 2. OneDrive
Write-Host "`n[2/3] Checando inicio automatico do OneDrive..." -ForegroundColor Yellow
$odPath = "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
if (Test-Path $odPath) {
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "OneDrive" -Value "`"$odPath`" /background"
    Write-Host "✅ OneDrive configurado para iniciar quietinho junto com o Windows!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Executavel do OneDrive nao encontrado no caminho padrao. Verifique se esta instalado." -ForegroundColor Red
}

# 3. Aviso final
Write-Host "`n[3/3] Dicas Finais..." -ForegroundColor Yellow
Write-Host "Verifique os passos manuais de IP e Autologin no arquivo INSTRUCOES_SERVIDOR.txt" -ForegroundColor White

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "🎉 SCRIPT PARCIALMENTE CONCLUIDO 🎉" -ForegroundColor Cyan
Write-Host "AGORA LEIA O ARQUIVO INSTRUCOES_SERVIDOR.txt PARA FINALIZAR O PLANO!" -ForegroundColor White

# Pausinha para o Ranniere ler
Start-Sleep -Seconds 10
