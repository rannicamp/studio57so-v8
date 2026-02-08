// Caminho: app/(landingpages)/residencialalfa/FormularioDeContato.js
'use client';

import { salvarLead } from './actions';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

// --- COMPONENTE DO BOTÃO DE ENVIO ---
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      disabled={pending} 
      className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-all duration-300 shadow-lg uppercase tracking-wider flex items-center justify-center"
    >
      {pending ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Enviando...
        </span>
      ) : (
        <span className="flex items-center">
          Receber Tabela de Vendas <FontAwesomeIcon icon={faPaperPlane} className="ml-2" />
        </span>
      )}
    </button>
  );
}

// --- COMPONENTE PRINCIPAL (MODAL) ---
export default function FormularioDeContato({ onClose }) {
  const [country, setCountry] = useState('BR');
  
  const mask = country === 'BR' ? '(00) 0000[0]-0000' : '(000) 000-0000';
  const countryCodeValue = country === 'BR' ? '+55' : '+1';

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    salvarLead(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      
      <div className="relative bg-white text-gray-800 rounded-2xl shadow-2xl p-8 max-w-lg w-full m-auto animate-fadeIn border-t-4 border-blue-600">
        
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 transition-colors bg-gray-100 hover:bg-blue-50 rounded-full p-2"
            aria-label="Fechar"
        >
            <FontAwesomeIcon icon={faTimes} size="lg" />
        </button>

        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 text-gray-800">
                Fale com um Consultor
            </h2>
            <p className="text-gray-600">
                Preencha os dados abaixo para receber o book e a <strong>Tabela de Vendas</strong> do Residencial Alfa.
            </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <input type="hidden" name="origem" value="Landing Page - Residencial Alfa" />
          <input type="hidden" name="country_code" value={countryCodeValue} />

          {/* Nome */}
          <div>
            <label htmlFor="nome" className="block text-gray-700 text-sm font-bold mb-2">Nome Completo</label>
            <input 
                type="text" 
                id="nome" 
                name="nome" 
                required 
                placeholder="Seu nome"
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
            />
          </div>
          
          {/* Telefone Internacional */}
          <div>
            <label htmlFor="telefone" className="block text-gray-700 text-sm font-bold mb-2">WhatsApp</label>
            <div className="flex items-center">
              <div className="relative">
                  <select 
                    onChange={(e) => setCountry(e.target.value)} 
                    value={country} 
                    className="appearance-none bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg py-3 pl-4 pr-8 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[50px]"
                  >
                    <option value="BR">🇧🇷 +55</option>
                    <option value="US">🇺🇸 +1</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
              </div>
              
              <IMaskInput
                mask={mask}
                id="telefone"
                name="telefone"
                required
                placeholder={country === 'BR' ? '(99) 99999-9999' : '(555) 555-5555'}
                className="w-full bg-gray-50 border border-gray-300 border-l-0 text-gray-900 rounded-r-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-[50px]"
              />
            </div>
          </div>

          <p className="text-xs text-center text-gray-500 mt-4 flex items-center justify-center">
            <FontAwesomeIcon icon={faCheck} className="mr-1 text-blue-600" />
            Seus dados estão protegidos.
          </p>
          
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}