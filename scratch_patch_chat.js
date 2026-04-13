const fs = require('fs');
let content = fs.readFileSync('components/whatsapp/panel/ChatInput.js', 'utf8');

content = content.replace(/import \{ FontAwesomeIcon \} from '@fortawesome\/react-fontawesome';\nimport \{ faPaperclip, faFileLines, faMicrophone, faPaperPlane, faSmile, faTimes, faStop, faImage, faMapMarkerAlt,\n faTrash, faCheck, faWandMagicSparkles, faUndo, faSpinner \} from '@fortawesome\/free-solid-svg-icons';/, `import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faFileLines, faMicrophone, faPaperPlane, faSmile, faTimes, faStop, faImage, faMapMarkerAlt, faLock, faTrash, faCheck, faWandMagicSparkles, faUndo, faSpinner } from '@fortawesome/free-solid-svg-icons';`);

content = content.replace(/export default function ChatInput\(\{ newMessage, setNewMessage, onSendMessage, onOpenUploader, onOpenTemplate, onOpenLocation, recorder, uploadingOrProcessing, onPasteFile\n\}\) \{/, `export default function ChatInput({ newMessage, setNewMessage, onSendMessage, onOpenUploader, onOpenTemplate, onOpenLocation, recorder, uploadingOrProcessing, onPasteFile, isWindowOpen\n}) {`);

content = content.replace(/\{\/\* INPUT DE TEXTO \*\/\}(.|\n)*?(?=<\/div>\n  \);\n\})/, `{/* INPUT DE TEXTO OU BLOQUEIO DE JANELA */}
  {!isWindowOpen ? (
    <div className="flex-grow bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-between py-2 px-4 shadow-sm opacity-80">
      <div className="flex items-center gap-3 text-gray-500">
        <FontAwesomeIcon icon={faLock} />
        <span className="text-sm font-medium">Janela Fechada (24h)</span>
      </div>
      <button onClick={onOpenTemplate} className="text-sm bg-[#00a884] text-white px-4 py-1.5 rounded shadow-sm hover:bg-[#008f6f] transition-colors flex items-center gap-2">
        <FontAwesomeIcon icon={faFileLines} /> Enviar Modelo
      </button>
    </div>
  ) : (
    <>
      <div className="flex-grow bg-white rounded-lg border border-gray-300 flex items-end py-2 px-4 shadow-sm focus-within:ring-2 focus-within:ring-[#00a884]/50 focus-within:border-[#00a884] transition-all">
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem"
          className="w-full max-h-[120px] resize-none outline-none text-gray-700 bg-transparent custom-scrollbar leading-6"
          rows={1}
        />
        <button type="button" className="text-gray-400 hover:text-gray-600 mb-1 ml-2">
          <FontAwesomeIcon icon={faSmile} size="lg" />
        </button>
      </div>

      {/* BOTÃO DESFAZER IA (Flutuante) */}
      {originalMessage && (
        <button type="button"
          onClick={() => { setNewMessage(originalMessage); setOriginalMessage(null); }}
          className="absolute -top-7 right-4 text-[12px] bg-red-100 text-red-600 px-3 py-1 rounded-full shadow border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-1 z-30"
        >
          <FontAwesomeIcon icon={faUndo} /> Desfazer Correção
        </button>
      )}

      {/* BOTÃO MAGIA IA */}
      <button type="button" onClick={handleAIMagic} disabled={!newMessage.trim() || aiMutation.isPending} title="Corrigir Gramática (IA)"
        className="p-3 text-indigo-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:scale-100 transition-transform hover:scale-110 active:scale-95 mb-1"
      >
        {aiMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin size="lg" /> : <FontAwesomeIcon icon={faWandMagicSparkles} size="lg" />}
      </button>

      {/* BOTÃO ENVIAR OU MICROFONE */}
      {newMessage.trim() ? (
        <button onClick={(e) => { onSendMessage(e); setOriginalMessage(null); }} disabled={uploadingOrProcessing}
          className="p-3 bg-[#00a884] text-white rounded-full shadow-md hover:bg-[#008f6f] transition-all mb-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      ) : (
        <button onClick={startRecording}
          className="p-3 bg-[#f0f2f5] text-gray-500 hover:bg-gray-200 rounded-full shadow-md transition-all mb-1"
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </button>
      )}
    </>
  )}
  </>
  )}`);

fs.writeFileSync('components/whatsapp/panel/ChatInput.js', content);
