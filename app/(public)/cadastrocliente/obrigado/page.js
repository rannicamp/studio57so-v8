// app/(public)/cadastro-cliente/obrigado/page.js
import Link from 'next/link';

export default function ObrigadoPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 className="text-3xl font-bold text-gray-800 mt-4">Cadastro Recebido!</h1>
        <p className="text-gray-600 mt-2">
          Obrigado por se cadastrar. Suas informações foram enviadas com sucesso para nossa equipe.
        </p>
        <p className="text-gray-600 mt-1">
          Em breve, um de nossos consultores entrará em contato.
        </p>
      </div>
    </div>
  );
}