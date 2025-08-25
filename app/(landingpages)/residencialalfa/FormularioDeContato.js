// Caminho do arquivo: app/(landingpages)/residencialalfa/FormularioDeContato.js

// Este componente também precisa rodar no navegador.
'use client';

// Importamos a ação que acabamos de criar.
import { salvarLead } from './actions';

export default function FormularioDeContato() {
  return (
    <form action={salvarLead} className="bg-white p-8 rounded-lg shadow-2xl space-y-5 max-w-lg mx-auto">
        <h3 className="text-3xl font-bold text-center text-gray-800">Fale com um consultor</h3>
        <p className="text-center text-gray-600">Receba a tabela de vendas e condições especiais de lançamento.</p>
        
        {/* ***** CAMPO OCULTO ADICIONADO AQUI ***** */}
        <input type="hidden" name="origem" value="Landing Page - Residencial Alfa" />

        <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome completo</label>
            <input type="text" name="nome" id="nome" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
        </div>
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Seu melhor e-mail</label>
            <input type="email" name="email" id="email" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
        </div>
        <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-700">Telefone (WhatsApp)</label>
            <input type="tel" name="telefone" id="telefone" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-md font-bold text-lg hover:bg-blue-700 transition-transform transform hover:scale-105">
            QUERO RECEBER A TABELA
        </button>
    </form>
  );
}