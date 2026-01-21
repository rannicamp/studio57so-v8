// Caminho: app/(landingpages)/betasuites/FormularioDeContatoBeta.js
'use client';

import { salvarLeadBeta } from './actions';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { IMaskInput } from 'react-imask';

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
      ) : 'Quero Mais Informações'}
    </button>
  );
}

export default function FormularioDeContatoBeta() {
  const [country, setCountry] = useState('BR');
  
  const mask = country === 'BR' ? '(00) 00000-0000' : '(000) 000-0000';
  const countryCodeValue = country === 'BR' ? '+55' : '+1';

  return (
    <form action={salvarLeadBeta} className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-2xl space-y-6">
        <h3 className="text-2xl font-bold text-center text-white mb-2">
          Interessado no <span className="text-orange-500">Beta Suítes</span>?
        </h3>
        <p className="text-center text-gray-300 text-sm mb-6">
          Preencha abaixo para receber o book completo e a tabela de investimento.
        </p>
        
        {/* CAMPOS OCULTOS */}
        <input type="hidden" name="origem" value="Landing Page - Beta Suítes" />
        <input type="hidden" name="country_code" value={countryCodeValue} />

        <div className="space-y-4">
            {/* Nome */}
            <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-300 mb-1 pl-1">Nome completo</label>
                <input type="text" name="nome" id="nome" required 
                  className="w-full bg-black/30 border border-white/10 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder-gray-500"
                  placeholder="Seu nome"
                />
            </div>

            {/* Telefone Internacional */}
            <div>
              <label htmlFor="telefone" className="block text-sm font-medium text-gray-300 mb-1 pl-1">WhatsApp</label>
              <div className="flex items-center">
                {/* Seletor de Bandeira */}
                <div className="relative">
                    <select 
                      onChange={(e) => setCountry(e.target.value)} 
                      value={country} 
                      className="appearance-none bg-black/30 border border-white/10 border-r-0 rounded-l-lg py-3 pl-3 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer h-[50px]"
                    >
                      <option value="BR">🇧🇷 +55</option>
                      <option value="US">🇺🇸 +1</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
                
                {/* Input Mascarado */}
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
        </div>

        <div className="pt-2">
           <SubmitButton />
        </div>

        <p className="text-xs text-center text-gray-500 mt-4 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Seus dados estão seguros conosco.
        </p>
    </form>
  );
}