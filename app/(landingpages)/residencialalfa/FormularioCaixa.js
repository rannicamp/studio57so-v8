// Caminho: app/(landingpages)/residencialalfa/FormularioCaixa.js
'use client';

import { salvarLeadCaixa } from './actionsCaixa';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faPaperPlane, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      disabled={pending} 
      className="w-full bg-blue-800 text-white font-bold py-4 px-6 rounded-lg hover:bg-blue-900 disabled:opacity-70 transition-all duration-300 shadow-lg uppercase tracking-wider flex items-center justify-center text-sm"
    >
      {pending ? (
        <span className="flex items-center">
          Enviando...
        </span>
      ) : (
        <span className="flex items-center">
          Solicitar Simulação <FontAwesomeIcon icon={faPaperPlane} className="ml-2" />
        </span>
      )}
    </button>
  );
}

export default function FormularioCaixa({ onClose }) {
  const [country, setCountry] = useState('BR');
  
  const maskPhone = country === 'BR' ? '(00) 0000[0]-0000' : '(000) 000-0000';
  const countryCodeValue = country === 'BR' ? '+55' : '+1';

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    salvarLeadCaixa(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      
      <div className="relative bg-white text-gray-800 rounded-2xl shadow-2xl max-w-lg w-full m-auto animate-fadeIn overflow-hidden">
        
        {/* Cabeçalho Estilo Caixa */}
        <div className="bg-blue-800 p-6 text-center relative">
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                aria-label="Fechar"
            >
                <FontAwesomeIcon icon={faTimes} size="lg" />
            </button>
            <div className="flex justify-center mb-2">
                 {/* Você pode usar o logo da caixa branco aqui se quiser, ou manter texto */}
                 <h2 className="text-2xl font-bold text-white uppercase tracking-wide">
                    Simulação de Financiamento
                </h2>
            </div>
            <p className="text-blue-100 text-sm">
                Preencha os dados para uma análise de crédito preliminar.
            </p>
        </div>

        <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
            
            <input type="hidden" name="origem" value="Residencial Alfa - Simulação Caixa" />
            <input type="hidden" name="country_code" value={countryCodeValue} />

            {/* Nome */}
            <div>
                <label htmlFor="nome" className="block text-gray-700 text-xs font-bold mb-1 uppercase">Nome Completo</label>
                <input 
                    type="text" 
                    id="nome" 
                    name="nome" 
                    required 
                    placeholder="Como no seu documento"
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                />
            </div>
            
            {/* Telefone */}
            <div>
                <label htmlFor="telefone" className="block text-gray-700 text-xs font-bold mb-1 uppercase">WhatsApp</label>
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
                </div>
                
                <IMaskInput
                    mask={maskPhone}
                    id="telefone"
                    name="telefone"
                    required
                    placeholder="(99) 99999-9999"
                    className="w-full bg-gray-50 border border-gray-300 border-l-0 text-gray-900 rounded-r-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-[50px]"
                />
                </div>
            </div>

            {/* Renda Familiar Bruta */}
            <div>
                <label htmlFor="renda" className="block text-gray-700 text-xs font-bold mb-1 uppercase">Renda Familiar Bruta (Mensal)</label>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 font-bold">R$</span>
                    <IMaskInput
                        mask={Number}
                        scale={2}
                        signed={false}
                        thousandsSeparator="."
                        padFractionalZeros={true}
                        normalizeZeros={true}
                        radix=","
                        mapToRadix={['.']}
                        id="renda"
                        name="renda"
                        required
                        placeholder="0,00"
                        className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg py-3 pl-12 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-bold text-lg"
                    />
                </div>
                <p className="text-xs text-gray-400 mt-1">Soma da renda de todas as pessoas que vão compor o financiamento.</p>
            </div>

            {/* Checkboxes Específicos */}
            <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" name="fgts" className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300" />
                    <span className="text-gray-700 text-sm font-medium">Possuo saldo no FGTS</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" name="tempo_trabalho" className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300" />
                    <span className="text-gray-700 text-sm font-medium">Tenho mais de 3 anos de carteira assinada (somando todos os empregos)</span>
                </label>
            </div>

            <p className="text-xs text-center text-gray-500 flex items-center justify-center">
                <FontAwesomeIcon icon={faCheck} className="mr-1 text-green-500" />
                Seus dados estão seguros e serão usados apenas para simulação.
            </p>
            
            <SubmitButton />
            </form>
        </div>
      </div>
    </div>
  );
}