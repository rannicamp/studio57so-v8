# Erro de Áudio "Lento/Arrastado" (Distorção de Pitch) no WhatsApp WebRTC

## 🚨 O Problema
Áudios gravados pelo microfone e enviados via Web pelo painel de Integração do WhatsApp no sistema ficavam com alteração crítica de tom (a famosa e famigerada *"voz de monstro"*, som arrastado, parecendo slow-motion).

## 🛠️ A Causa
O desastre residia num problema clássico de *Sample Rate Mismatch* (Erro de Incompatibilidade de Amostragem) em tempo de extração para mp3.

O WebRTC (`navigator.mediaDevices.getUserMedia`) do navegador Windows/Mobile captura dados raw PCM normalmente em alta definição, na casa dos **48.000 Hz**. Em `useAudioRecorder.js`, na rotina de parada da gravação, o script efetuava a *"limpeza da memória (cleanupResources)"* **antes** de aferir o referencial de `sampleRate`:

```jsx
// ROTINA FATAL (ORIGINAL)
cleanupResources(); // Anula os Contextos de Audio
const finalSampleRate = audioContextRef.current?.sampleRate || 44100; // Sempre caía no fallback falso
```
Como o `audioContext` já era `null`, a taxa sempre caia no defaut imposto de **44.100 Hz**.
Desta forma, os buffers raw gravados em passos de 48.000 quadros por segundo, ao entrarem num codificador `lame.js` sob promessa de "sou apenas 44.100 quadros", resultavam na diluição e alongamento espectral. Ex: 1 segundo a 48k forçado em 44.1k = aúdio passa a tocar matematicamente mais devagar e seu "pitch" declina resultando em voz grave/fúnebre.

## ✅ A Solução
Basta deslocar e extrair o metadado **antes** da limpeza da stream, injetando o rate real de captação no Encoder MP3.

```jsx
// NOVO FLUXO DE SEGURANÇA
// 1. Capta a verdade sobre a máquina primeiro!
const finalSampleRate = audioContextRef.current?.sampleRate || 44100; 

// 2. Destrói stream, Tracks e Desaloca a RAM
cleanupResources();

// 3. Envia os dados crus + a taxa autêntica para o motor do MP3.
await convertAndSendMp3(audioDataRef.current, finalSampleRate); 
```

> **Lição:** Quando estiver convertendo ou gravando *buffers* e lidando com streams WebRTC, **nunca assuma uma taxa estática**. Puxe sempre a propriedade `.sampleRate` da instância gravadora ATIVA sob pena de corromper o tempo de reprodução da interface consumidora (Whatsapp, PABX).
