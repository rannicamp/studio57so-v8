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
    // O PORQUÊ DA MUDANÇA: A cor do botão foi atualizada para 'bg-orange-500' para manter
    // a consistência com o botão da página principal, usando o tom mais saturado que você escolheu.
    <button type="submit" disabled={pending} className="w-full bg-orange-500 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-orange-600 disabled:bg-gray-400 transition-all duration-300 hover:scale-105">
      {pending ? 'Enviando...' : 'Quero Saber Mais'}
    </button>
  );
}

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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      {/* O PORQUÊ DA MUDANÇA NO FUNDO DO MODAL:
        - 'bg-gray-800' foi REMOVIDO.
        - 'bg-black/60 backdrop-blur-lg border border-white/20' foi ADICIONADO.
        - Isso transforma o fundo do formulário inteiro no nosso design de "vidro fumê",
          criando o efeito de um painel de vidro flutuante, como pediste para o teste.
      */}
      <div className="bg-black/60 backdrop-blur-lg border border-white/20 text-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
        <h2 className="text-2xl font-bold text-center mb-1">Seja o primeiro a saber!</h2>
        <p className="text-center text-gray-300 mb-6">Deixe seus dados para receber informações sobre o Studios Beta.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="nome" className="block text-gray-300 text-sm font-bold mb-2">Nome Completo</label>
            {/* O PORQUÊ DA MUDANÇA NO CAMPO DE TEXTO:
              - O fundo 'bg-gray-700' foi trocado por 'bg-black/50', um tom sutilmente diferente do fundo do modal
                para criar uma profundidade visual.
              - A borda foi atualizada para 'border-white/20'.
              - A cor do foco ('focus:ring-orange-500') foi atualizada para manter a consistência.
            */}
            <input type="text" id="nome" name="nome" required className="w-full bg-black/50 border border-white/20 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          
          <div className="mb-6">
            <label htmlFor="telefone" className="block text-gray-300 text-sm font-bold mb-2">Telefone (WhatsApp)</label>
            <div className="flex">
              {/* O PORQUÊ DA MUDANÇA NA CAIXA DE SELEÇÃO (SELECT):
                - Este foi o seu pedido original. Apliquei exatamente o mesmo estilo de "vidro fumê"
                  ('bg-black/50', 'border-white/20') para que ela se integre perfeitamente.
                - 'border-r-0' foi adicionado para que ela se junte visualmente ao campo de telefone.
              */}
              <select onChange={(e) => setCountry(e.target.value)} value={country} className="bg-black/50 border border-white/20 border-r-0 rounded-l-lg px-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="BR">🇧🇷 +55</option>
                <option value="US">🇺🇸 +1</option>
              </select>
              <IMaskInput
                mask={mask}
                id="telefone"
                name="telefone"
                required
                placeholder={country === 'BR' ? '(33) 99999-9999' : '(555) 555-5555'}
                // O PORQUÊ: O mesmo estilo foi aplicado aqui para consistência.
                className="w-full bg-black/50 border border-white/20 border-l-0 text-white rounded-r-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}