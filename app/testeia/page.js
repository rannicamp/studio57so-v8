"use client";

import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faRobot, faUser, faSpinner, faBrain } from "@fortawesome/free-solid-svg-icons";

export default function GeminiChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Rolagem automática para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 1. Adiciona a mensagem do usuário na tela
    const userMessage = {
      role: "user",
      content: input,
      thoughtSignature: null // Usuário não pensa (no sentido de IA rs), então é null
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // 2. Cria um placeholder vazio para a resposta da IA (para o efeito de digitação)
      const aiPlaceholder = { role: "model", content: "", thoughtSignature: null };
      setMessages((prev) => [...prev, aiPlaceholder]);

      // 3. Chama a nossa API (O Cérebro)
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage], // Envia todo o histórico para contexto
        }),
      });

      if (!response.ok) throw new Error(response.statusText);

      // 4. Processa o Streaming (Recebe os dados em pedacinhos)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let finalSignature = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Processa as linhas completas do buffer (formato NDJSON)
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Guarda o pedaço incompleto para a próxima rodada

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            // Se veio texto, acumula
            if (data.text) {
              accumulatedText += data.text;
            }
            
            // Se veio a assinatura do pensamento (O Segredo do Gemini 3), guarda ela!
            if (data.thoughtSignature) {
              finalSignature = data.thoughtSignature;
              console.log("🧠 Assinatura de Pensamento Recebida:", finalSignature.substring(0, 20) + "...");
            }

            // Atualiza a última mensagem na tela com o texto acumulado
            setMessages((prev) => {
              const newMsgs = [...prev];
              const lastMsg = newMsgs[newMsgs.length - 1];
              lastMsg.content = accumulatedText;
              // Salva a assinatura na mensagem para ser enviada na próxima vez
              lastMsg.thoughtSignature = finalSignature || lastMsg.thoughtSignature; 
              return newMsgs;
            });

          } catch (err) {
            console.error("Erro ao ler pedaço da resposta:", err);
          }
        }
      }

    } catch (error) {
      console.error("Falha ao enviar mensagem:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: "Ops! Tive um problema para raciocinar: " + error.message, isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-4xl mx-auto p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm mt-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 mb-4 bg-white p-4 rounded-t-xl -mt-4 -mx-4 shadow-sm z-10">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-full text-white shadow-md">
            <FontAwesomeIcon icon={faBrain} className="w-5 h-5" />
        </div>
        <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Gemini 3.0 Pro <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">Preview</span>
            </h1>
            <p className="text-xs text-gray-500">Modo de Raciocínio Ativo • Studio 57</p>
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto space-y-6 p-4 custom-scrollbar">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                <FontAwesomeIcon icon={faRobot} className="text-6xl mb-4" />
                <p className="text-lg font-medium">Estou pronto para raciocinar.</p>
                <p className="text-sm">Faça uma pergunta complexa.</p>
            </div>
        )}
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "model" && (
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <FontAwesomeIcon icon={faRobot} className="text-purple-600 text-sm" />
                </div>
            )}
            
            <div
              className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
              } ${msg.isError ? "bg-red-50 text-red-600 border-red-200" : ""}`}
            >
              {msg.content}
              
              {/* Indicador visual de que a memória (Thought Signature) foi capturada */}
              {msg.role === "model" && msg.thoughtSignature && (
                  <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1 select-none">
                      <FontAwesomeIcon icon={faBrain} className="text-purple-400" />
                      <span>Contexto de raciocínio salvo</span>
                  </div>
              )}
            </div>

            {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <FontAwesomeIcon icon={faUser} className="text-blue-600 text-sm" />
                </div>
            )}
          </div>
        ))}
        {/* Elemento invisível para rolar até o fim */}
        <div ref={messagesEndRef} />
      </div>

      {/* Área de Input */}
      <form onSubmit={sendMessage} className="pt-4 border-t border-gray-200 mt-2 bg-white -mx-4 -mb-4 p-4 rounded-b-xl z-10">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite algo complexo..."
            className="flex-1 p-3.5 pr-14 border border-gray-300 rounded-full shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 text-gray-800 placeholder-gray-400 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95"
          >
            {isLoading ? (
                <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
                <FontAwesomeIcon icon={faPaperPlane} className="-ml-0.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-3 font-mono">
            Powered by Google Gemini 3.0 • Ranniere Campos
        </p>
      </form>
    </div>
  );
}