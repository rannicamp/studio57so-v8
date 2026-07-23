// Caminho: app/(landingpages)/elo57/components/FormularioElo57.js
'use client';

import { salvarLeadElo57 } from '../actions';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { IMaskInput } from 'react-imask';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

// Botão de Envio com Loading
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      disabled={pending}
      className="w-full bg-[#f25a2f] hover:bg-[#e04f25] text-white font-bold py-4 px-6 rounded-xl disabled:opacity-70 transition-all duration-300 shadow-lg uppercase tracking-wider flex items-center justify-center cursor-pointer text-sm md:text-base border-none outline-none mt-2"
    >
      {pending ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Garantindo Vaga...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          Garantir Acesso Antecipado <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
        </span>
      )}
    </button>
  );
}

export default function FormularioElo57({ onClose }) {
  const [tipoPessoa, setTipoPessoa] = useState('PF'); // 'PF' ou 'PJ'
  const [country, setCountry] = useState('BR');
  
  // States para campos condicionais "Outros"
  const [profissao, setProfissao] = useState('');
  const [segmento, setSegmento] = useState('');

  const maskPhone = country === 'BR' ? '(00) 0000[0]-0000' : '(000) 000-0000';
  const countryCodeValue = country === 'BR' ? '+55' : '+1';

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    // Tratamento dos campos de "Outros" antes de enviar
    if (tipoPessoa === 'PF') {
      formData.set('personalidade_juridica', 'Pessoa Física');
      const finalCargo = profissao === 'Outros' ? formData.get('outra_profissao') : profissao;
      formData.set('cargo', finalCargo);
      // Limpa campos de PJ para não enviar lixo
      formData.delete('cnpj');
      formData.delete('razao_social');
      formData.delete('pessoa_contato');
    } else {
      formData.set('personalidade_juridica', 'Pessoa Jurídica');
      // No caso de empresa, salvamos o nome da empresa como o principal "nome"
      const nomeEmpresa = formData.get('razao_social');
      formData.set('nome', nomeEmpresa);
      const finalCargo = segmento === 'Outros' ? formData.get('outro_segmento') : segmento;
      formData.set('cargo', finalCargo);
      // Limpa campos de PF para não enviar lixo
      formData.delete('cpf');
    }

    salvarLeadElo57(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      {/* Box do Formulário */}
      <div className="relative bg-white text-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-xl w-full m-auto animate-fadeIn border-t-4 border-[#f25a2f] max-h-[90vh] overflow-y-auto scrollbar-thin">
        
        {/* Botão Fechar */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#f25a2f] transition-colors bg-gray-100 hover:bg-orange-50 rounded-full p-2 w-8 h-8 flex items-center justify-center cursor-pointer border-none outline-none z-50"
          aria-label="Fechar"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-slate-900 tracking-tight">
            Lista de Espera & Testes
          </h2>
          <p className="text-sm text-slate-500 font-light leading-relaxed">
            Cadastre-se na Lista de Espera oficial do Elo 57 e garanta sua vaga para o evento de testes no dia **19 de Agosto**.
          </p>
        </div>

        {/* Seletor de Tipo de Pessoa (PF / PJ) */}
        <div className="flex border border-slate-100 rounded-xl p-1 mb-6 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setTipoPessoa('PF')}
            className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all border-none outline-none cursor-pointer ${
              tipoPessoa === 'PF' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 bg-transparent'
            }`}
          >
            Pessoa Física
          </button>
          <button
            type="button"
            onClick={() => setTipoPessoa('PJ')}
            className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all border-none outline-none cursor-pointer ${
              tipoPessoa === 'PJ' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 bg-transparent'
            }`}
          >
            Pessoa Jurídica
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="origem" value="Landing Page - Elo 57 (Pré-Lançamento)" />
          <input type="hidden" name="country_code" value={countryCodeValue} />
          <input type="hidden" name="personalidade_juridica" value={tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'} />

          {/* CAMPOS COMUNS */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* WhatsApp */}
            <div>
              <label htmlFor="telefone" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">WhatsApp</label>
              <div className="flex items-center">
                <div className="relative">
                  <select 
                    onChange={(e) => setCountry(e.target.value)} 
                    value={country}
                    className="appearance-none bg-slate-50 border border-slate-200 border-r-0 rounded-l-xl py-3 pl-3 pr-7 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] cursor-pointer h-[48px] text-sm"
                  >
                    <option value="BR">🇧🇷 +55</option>
                    <option value="US">🇺🇸 +1</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
                <IMaskInput
                  mask={maskPhone}
                  id="telefone"
                  name="telefone"
                  required
                  placeholder={country === 'BR' ? '(99) 99999-9999' : '(555) 555-5555'}
                  className="w-full bg-slate-50 border border-slate-200 border-l-0 text-slate-900 rounded-r-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm"
                />
              </div>
            </div>

            {/* E-mail */}
            <div>
              <label htmlFor="email" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">E-mail Corporativo</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                required 
                placeholder="exemplo@empresa.com.br"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
              />
            </div>
          </div>

          {/* SEÇÕES CONDICIONAIS */}
          {tipoPessoa === 'PF' ? (
            /* --- PESSOA FÍSICA --- */
            <div className="space-y-4 animate-fadeIn">
              {/* Nome */}
              <div>
                <label htmlFor="nome" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  id="nome" 
                  name="nome" 
                  required 
                  placeholder="Seu nome completo"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* CPF */}
                <div>
                  <label htmlFor="cpf" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">CPF</label>
                  <IMaskInput
                    mask="000.000.000-00"
                    id="cpf"
                    name="cpf"
                    required
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm"
                  />
                </div>

                {/* Profissão */}
                <div>
                  <label htmlFor="profissao" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Profissão</label>
                  <select 
                    id="profissao" 
                    value={profissao} 
                    onChange={(e) => setProfissao(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="Incorporadora Imobiliária">Incorporadora Imobiliária</option>
                    <option value="Engenheiro Civil">Engenheiro Civil</option>
                    <option value="Arquiteto">Arquiteto</option>
                    <option value="Profissional Liberal">Profissional Liberal</option>
                    <option value="Corretor de Imóveis">Corretor de Imóveis</option>
                    <option value="Investidor Imobiliário">Investidor Imobiliário</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              {/* Se for "Outros", abre campo de texto */}
              {profissao === 'Outros' && (
                <div className="animate-slideDown">
                  <label htmlFor="outra_profissao" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Especifique sua profissão</label>
                  <input 
                    type="text" 
                    id="outra_profissao" 
                    name="outra_profissao" 
                    required 
                    placeholder="Digite sua profissão"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                  />
                </div>
              )}
            </div>
          ) : (
            /* --- PESSOA JURÍDICA --- */
            <div className="space-y-4 animate-fadeIn">
              {/* Razão Social / Nome da Empresa */}
              <div>
                <label htmlFor="razao_social" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Razão Social / Nome da Empresa</label>
                <input 
                  type="text" 
                  id="razao_social" 
                  name="razao_social" 
                  required 
                  placeholder="Nome fantasia ou razão social da empresa"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* CNPJ */}
                <div>
                  <label htmlFor="cnpj" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">CNPJ</label>
                  <IMaskInput
                    mask="00.000.000/0000-00"
                    id="cnpj"
                    name="cnpj"
                    required
                    placeholder="00.000.000/0000-00"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm"
                  />
                </div>

                {/* Segmento / Atuação da Empresa */}
                <div>
                  <label htmlFor="segmento" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Segmento de Atuação</label>
                  <select 
                    id="segmento" 
                    value={segmento} 
                    onChange={(e) => setSegmento(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="Construtora">Construtora</option>
                    <option value="Incorporadora">Incorporadora</option>
                    <option value="Investidor Imobiliário">Investidor Imobiliário</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              {/* Se for "Outros", abre campo de texto */}
              {segmento === 'Outros' && (
                <div className="animate-slideDown">
                  <label htmlFor="outro_segmento" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Especifique o segmento</label>
                  <input 
                    type="text" 
                    id="outro_segmento" 
                    name="outro_segmento" 
                    required 
                    placeholder="Ex: Fabricante de Insumos, Metalúrgica"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                  />
                </div>
              )}

              {/* Responsável da Empresa */}
              <div>
                <label htmlFor="pessoa_contato" className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">Nome do Responsável / Contato</label>
                <input 
                  type="text" 
                  id="pessoa_contato" 
                  name="pessoa_contato" 
                  required 
                  placeholder="Seu nome completo"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#f25a2f]/20 focus:border-[#f25a2f] transition-all h-[48px] text-sm" 
                />
              </div>
            </div>
          )}

          {/* Rodapé de Proteção */}
          <p className="text-[11px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1.5">
            <FontAwesomeIcon icon={faCheck} className="text-[#f25a2f]" />
            Seus dados estão protegidos sob a LGPD.
          </p>

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
