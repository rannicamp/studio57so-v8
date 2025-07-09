"use client";

import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const [message, setMessage] = useState('');

  const handleSendMessage = async () => {
    setMessage('Enviando mensagem de teste...');
    try {
      // Note que a API que chamamos não muda.
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '5533991912291', // Seu número pessoal para receber o teste
          type: 'template',   // Continuamos dizendo que é um template
          
          // ***** CORREÇÃO APLICADA AQUI *****
          templateName: 'teste_2', // Nome exato do SEU novo modelo aprovado
          languageCode: 'en',      // Idioma do modelo que você criou (English)
        
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro desconhecido');
      }

      setMessage('Mensagem enviada com sucesso! Verifique seu WhatsApp.');
    } catch (error) {
      setMessage(`Erro ao enviar: ${error.message}`);
    }
  };

  return (
    <main className="text-center space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Principal</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md max-w-sm mx-auto">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">Teste de Integração - WhatsApp</h2>
        <button 
          onClick={handleSendMessage}
          className="bg-green-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-green-600 w-full"
        >
          Enviar Mensagem de Teste
        </button>
        {message && <p className="text-sm mt-4">{message}</p>}
      </div>

      <div className="space-x-4">
        <Link href="/empresas/cadastro" className="inline-block bg-blue-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-600">
          Cadastrar Nova Empresa
        </Link>
        <Link href="/upload" className="inline-block bg-cyan-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-cyan-600">
          Upload de Marca
        </Link>
      </div>
    </main>
  );
}