// Caminho: app/(landingpages)/betasuites/FormularioDeContatoBeta.js
'use client';

import { salvarLeadBeta } from './actions';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';

// --- COMPONENTE DO BOTÃO DE ENVIO ---
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      disabled={pending} 
      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 px-6 rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-70 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-orange-500/20 text-lg uppercase tracking-wider flex items-center justify-center"
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
          Quero Garantir Minha Unidade <FontAwesomeIcon icon={faCheck} className="ml-2" />
        </span>
      )}
    </button>
  );
}

// --- COMPONENTE PRINCIPAL DO FORMULÁRIO ---
export default function FormularioDeContatoBeta({ onClose }) {
  const [country, setCountry] = useState('BR');
  const mask = country === 'BR' ? '(00) 0000[0]-0000' : '(000) 000-0000';
  const countryCode = country === 'BR' ? '+55' : '+1';

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const unmaskedPhone = (formData.get('telefone') || '').replace(/\D/g, '');
    const fullPhone = `${countryCode}${unmaskedPhone}`;
    formData.set('telefone', fullPhone);
    salvarLeadBeta(formData);
  };

  return (
    // Fundo do modal escuro com blur
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      
      {/* Container principal estilo "Vidro Fumê" */}
      <div className="relative bg-black/60 backdrop-blur-md border border-white/10 text-white rounded-2xl shadow-2xl p-8 max-w-lg w-full m-auto mt-10 mb-10 animate-fadeIn">
        
        {/* Botão de fechar */}
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-2"
            aria-label="Fechar"
        >
            <FontAwesomeIcon icon={faTimes} size="lg" />
        </button>

        {/* Cabeçalho do Formulário */}
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3 text-white">
                Pré-Lançamento <span className="text-orange-500">Exclusivo</span>
            </h2>
            <p className="text-gray-300 text-lg leading-relaxed">
                Cadastre-se agora para receber a <strong>Tabela Zero</strong> e o Book completo antes da abertura oficial ao mercado.
            </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Nome */}
          <div>
            <label htmlFor="nome" className="block text-gray-300 text-sm font-bold mb-2 ml-1">Nome Completo</label>
            {/* MUDANÇA AQUI: bg-black/30 e border-white/10 para efeito vidro */}
            <input 
                type="text" 
                id="nome" 
                name="nome" 
                required 
                placeholder="Digite seu nome"
                className="w-full bg-black/30 border border-white/10 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder-gray-500" 
            />
          </div>
          
          {/* Campo Telefone */}
          <div>
            <label htmlFor="telefone" className="block text-gray-300 text-sm font-bold mb-2 ml-1">WhatsApp (para envio do material)</label>
            <div className="flex items-center">
              {/* Select de País - MUDANÇA AQUI: bg-black/30 e border-white/10 */}
              <div className="relative">
                  <select 
                    onChange={(e) => setCountry(e.target.value)} 
                    value={country} 
                    className="appearance-none bg-black/30 border border-white/10 border-r-0 rounded-l-lg py-3 pl-4 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all cursor-pointer h-[50px]"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  >
                    <option value="BR" className="text-gray-900">🇧🇷 +55</option>
                    <option value="US" className="text-gray-900">🇺🇸 +1</option>
                  </select>
                  {/* Setinha customizada para o select */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
              </div>
              
              {/* Input de Telefone com Máscara - MUDANÇA AQUI: bg-black/30 e border-white/10 */}
              <IMaskInput
                mask={mask}
                id="telefone"
                name="telefone"
                required
                placeholder={country === 'BR' ? '(99) 99999-9999' : '(555) 555-5555'}
                className="w-full bg-black/30 border border-white/10 border-l-0 text-white rounded-r-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder-gray-500 h-[50px]"
              />
            </div>
          </div>

          {/* Garantia de Privacidade */}
          <p className="text-xs text-center text-gray-500 mt-4 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Seus dados estão seguros. Não enviamos spam.
          </p>
          
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}