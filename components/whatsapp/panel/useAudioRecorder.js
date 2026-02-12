import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export function useAudioRecorder(onSendAudio) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioDataRef = useRef([]);
    const recordingInterval = useRef(null);

    // Carrega o script do LameJS (MP3 converter)
    useEffect(() => {
        if (typeof window !== 'undefined' && !window.lamejs) {
            const script = document.createElement('script');
            script.src = '/lame.min.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    const startRecording = async () => {
        // BLINDAGEM: Verifica suporte do navegador
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast.error("Seu navegador ou dispositivo não suporta gravação de áudio.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false } 
            });
            
            mediaStreamRef.current = stream;
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            audioDataRef.current = [];
            processor.onaudioprocess = (e) => { 
                audioDataRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0))); 
            };
            
            source.connect(processor); 
            processor.connect(audioContext.destination);
            
            setIsRecording(true); 
            setRecordingTime(0); 
            recordingInterval.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

        } catch (err) { 
            console.error("Erro ao iniciar gravação:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                toast.error("Permissão de microfone negada. Verifique as configurações do navegador.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                toast.error("Nenhum microfone encontrado neste dispositivo.");
            } else {
                toast.error("Erro no microfone: " + err.message);
            }
        }
    };

    const stopRecording = async () => {
        if (!isRecording) return;
        
        setIsRecording(false); 
        setIsProcessing(true);
        
        cleanupResources();

        try { 
            const finalSampleRate = audioContextRef.current?.sampleRate || 44100; // Pega taxa antes de fechar totalmente se possível, ou usa padrão
            await convertAndSendMp3(audioDataRef.current, finalSampleRate); 
        } 
        catch (error) { 
            toast.error("Erro ao processar áudio: " + error.message); 
        } 
        finally { 
            setIsProcessing(false); 
            audioDataRef.current = []; 
        }
    };

    const cancelRecording = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        setRecordingTime(0);
        cleanupResources();
        audioDataRef.current = [];
        toast.info("Gravação cancelada");
    };

    const cleanupResources = () => {
        if (recordingInterval.current) clearInterval(recordingInterval.current);
        if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
        if (mediaStreamRef.current) { 
            mediaStreamRef.current.getTracks().forEach(t => t.stop()); 
            mediaStreamRef.current = null; 
        }
        if (audioContextRef.current) { 
            audioContextRef.current.close().catch(e => console.log(e)); 
            audioContextRef.current = null; 
        }
    };

    const convertAndSendMp3 = async (buffers, sampleRate) => {
        if (!buffers || !buffers.length) return;
        if (!window.lamejs) throw new Error("Conversor de áudio não carregou. Tente recarregar a página.");
        
        const mp3Encoder = new window.lamejs.Mp3Encoder(1, sampleRate, 192);
        const mp3Data = [];
        let totalLength = 0;
        
        for (let i = 0; i < buffers.length; i++) totalLength += buffers[i].length;
        const samples = new Int16Array(totalLength);
        let offset = 0;
        
        for (let i = 0; i < buffers.length; i++) {
            for (let j = 0; j < buffers[i].length; j++) {
                let s = Math.max(-1, Math.min(1, buffers[i][j]));
                samples[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
        }
        
        const sampleBlockSize = 1152;
        for (let i = 0; i < samples.length; i += sampleBlockSize) {
            const mp3buf = mp3Encoder.encodeBuffer(samples.subarray(i, i + sampleBlockSize));
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }
        
        const mp3buf = mp3Encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
        
        const mp3File = new File([new Blob(mp3Data, { type: 'audio/mpeg' })], `audio_${Date.now()}.mp3`, { type: 'audio/mpeg' });
        
        // Chama a função de envio passada pelo componente pai
        if(onSendAudio) {
            onSendAudio({ file: mp3File, caption: '' });
        }
    };

    return {
        isRecording,
        recordingTime,
        isProcessing,
        startRecording,
        stopRecording,
        cancelRecording
    };
}