import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faFileLines, faMicrophone, faSpinner, faPaperPlane, faTrash, faStop } from '@fortawesome/free-solid-svg-icons';

export default function ChatInput({ 
    newMessage, 
    setNewMessage, 
    onSendMessage, 
    onOpenUploader, 
    onOpenTemplate, 
    recorder,
    uploadingOrProcessing 
}) {
    // Formata o tempo do gravador
    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="bg-[#f0f2f5] px-4 py-2 flex items-center gap-2 z-20">
            {/* LÓGICA DE BOTÕES ESQUERDOS */}
            {recorder.isRecording ? (
                <button 
                    onClick={recorder.cancelRecording} 
                    className="text-red-500 hover:text-red-600 p-2 transition-transform hover:scale-110"
                    title="Cancelar gravação"
                >
                    <FontAwesomeIcon icon={faTrash} size="lg" />
                </button>
            ) : (
                <>
                    <button onClick={onOpenUploader} className="text-gray-500 hover:text-gray-700 p-2" disabled={uploadingOrProcessing}>
                        <FontAwesomeIcon icon={faPaperclip} size="lg" />
                    </button>
                    {!recorder.isProcessing && <button onClick={onOpenTemplate} className="text-gray-500 hover:text-gray-700 p-2"><FontAwesomeIcon icon={faFileLines} size="lg" /></button>}
                </>
            )}

            <div className="flex-grow bg-white rounded-lg border border-white flex items-center py-2 px-4 shadow-sm focus-within:ring-1 focus-within:ring-[#00a884] transition-all">
                {recorder.isRecording ? (
                    <div className="flex-grow flex items-center text-red-500 font-medium animate-pulse">
                        <span><FontAwesomeIcon icon={faMicrophone} className="mr-2" /> Gravando... {formatTime(recorder.recordingTime)}</span>
                    </div>
                ) : (recorder.isProcessing || uploadingOrProcessing) ? (
                    <div className="flex-grow flex items-center gap-2 text-gray-500 font-medium">
                        <FontAwesomeIcon icon={faSpinner} spin /> Processando...
                    </div>
                ) : (
                    <textarea 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(e); } }} 
                        placeholder="Digite uma mensagem" 
                        className="w-full bg-transparent border-none focus:ring-0 resize-none text-gray-700 max-h-24 custom-scrollbar p-0 placeholder-gray-400" 
                        rows={1} 
                        style={{ minHeight: '24px' }} 
                    />
                )}
            </div>

            {newMessage.trim() ? (
                <button onClick={onSendMessage} disabled={uploadingOrProcessing} className="text-[#00a884] hover:text-[#008f6f] p-2">
                    {uploadingOrProcessing ? <FontAwesomeIcon icon={faSpinner} spin size="lg"/> : <FontAwesomeIcon icon={faPaperPlane} size="lg" />}
                </button>
            ) : (
                <button 
                    onClick={recorder.isRecording ? recorder.stopRecording : recorder.startRecording} 
                    disabled={recorder.isProcessing || uploadingOrProcessing} 
                    className={`p-2 ${recorder.isRecording ? 'text-green-500 hover:text-green-600 scale-110' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {recorder.isProcessing ? <FontAwesomeIcon icon={faSpinner} spin size="lg" /> : <FontAwesomeIcon icon={recorder.isRecording ? faPaperPlane : faMicrophone} size="lg" />}
                </button>
            )}
        </div>
    );
}