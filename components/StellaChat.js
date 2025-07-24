// components/StellaChat.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Assumindo que useAuth fornece o user.id

export default function StellaChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && user?.id) {
      // Fetch chat history when the chat is opened
      fetchChatHistory();
    }
  }, [isOpen, user?.id]);

  const fetchChatHistory = async () => {
    try {
      const response = await fetch(`/api/stella-chat/history?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      } else {
        console.error('Failed to fetch chat history:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() === '' || !user?.id) return;

    const userMessage = { sender_type: 'user', message_content: input, created_at: new Date().toISOString() };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/stella-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, message: input }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage = { sender_type: 'ai', message_content: data.analysis, created_at: new Date().toISOString() };
        setMessages((prevMessages) => [...prevMessages, aiMessage]);
      } else {
        console.error('Failed to send message:', response.statusText);
        setMessages((prevMessages) => [...prevMessages, { sender_type: 'ai', message_content: 'Desculpe, houve um erro ao processar sua mensagem.', created_at: new Date().toISOString() }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => [...prevMessages, { sender_type: 'ai', message_content: 'Desculpe, houve um erro de conexão.', created_at: new Date().toISOString() }]);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Botão flutuante da Stella */}
      <button
        onClick={toggleChat}
        className="fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 z-50"
        aria-label="Abrir Chat com Stella"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Janela de Chat */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className="fixed bottom-24 right-8 w-80 h-[400px] bg-white rounded-lg shadow-xl flex flex-col z-50 border border-gray-200"
        >
          <div className="bg-blue-600 text-white p-3 rounded-t-lg flex justify-between items-center">
            <h3 className="text-lg font-semibold">Chat com Stella</h3>
            <button onClick={toggleChat} className="text-white hover:text-gray-200 focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                Olá! Eu sou a Stella. Como posso te ajudar hoje?
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] p-3 rounded-lg ${
                    msg.sender_type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {msg.message_content}
                  <div className="text-xs mt-1 opacity-75 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-gray-200 flex">
            <input
              type="text"
              className="flex-1 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite sua mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
            />
            <button
              onClick={handleSendMessage}
              className="ml-2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}