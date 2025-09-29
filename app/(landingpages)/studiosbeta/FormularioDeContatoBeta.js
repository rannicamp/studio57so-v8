// Caminho: app/(landingpages)/studiosbeta/FormularioDeContatoBeta.js
'use client';

import { salvarLeadBeta } from './actions';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full bg-amber-500 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-amber-600 disabled:bg-gray-400">
      {pending ? 'Enviando...' : 'Quero Saber Mais'}
    </button>
  );
}

export default function FormularioDeContatoBeta({ onClose }) {
  const [country, setCountry] = useState('BR');
  const mask = country === 'BR' ? '(00) 0000[0]-0000' : '(000) 000-0000';
  const countryCode = country === 'BR' ? '+55' : '+1';

  // O PORQUÊ DESTA FUNÇÃO:
  // Precisamos combinar o DDI (+55) com o número do formulário antes de enviar.
  // Esta função intercepta o envio, ajusta o campo 'telefone' e prossegue.
  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const unmaskedPhone = (formData.get('telefone') || '').replace(/\D/g, '');
    const fullPhone = `${countryCode}${unmaskedPhone}`;
    formData.set('telefone', fullPhone); // Atualiza o formData com o número completo
    salvarLeadBeta(formData); // Chama a server action com os dados corretos
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 text-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
        <h2 className="text-2xl font-bold text-center mb-1">Seja o primeiro a saber!</h2>
        <p className="text-center text-gray-300 mb-6">Deixe seus dados para receber informações sobre o Studios Beta.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="nome" className="block text-gray-300 text-sm font-bold mb-2">Nome Completo</label>
            <input type="text" id="nome" name="nome" required className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          
          <div className="mb-6">
            <label htmlFor="telefone" className="block text-gray-300 text-sm font-bold mb-2">Telefone (WhatsApp)</label>
            <div className="flex">
              <select onChange={(e) => setCountry(e.target.value)} value={country} className="bg-gray-700 border border-gray-600 rounded-l-lg px-2 text-white focus:outline-none">
                <option value="BR">🇧🇷 +55</option>
                <option value="US">🇺🇸 +1</option>
              </select>
              <IMaskInput
                mask={mask}
                id="telefone"
                name="telefone"
                required
                placeholder={country === 'BR' ? '(33) 99999-9999' : '(555) 555-5555'}
                className="w-full bg-gray-700 border border-gray-600 border-l-0 text-white rounded-r-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}