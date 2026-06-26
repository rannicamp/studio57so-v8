// Caminho: app/(landingpages)/elo57/components/PainelDoresSection.js
'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faBan, faFolderOpen } from '@fortawesome/free-solid-svg-icons';

export default function PainelDoresSection() {
  return (
    <section 
      id="dores" 
      className="snap-start min-h-screen md:h-screen flex flex-col justify-center bg-white px-6 py-16 md:py-0 overflow-hidden relative"
    >
      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            O Grande Desafio
          </span>
          <h2 className="text-4xl md:text-6xl font-light text-slate-900 mb-6 tracking-tight leading-tight">
            O caos da gestão <span className="font-bold text-slate-950">descentralizada.</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto font-light leading-relaxed">
            Incorporadoras com múltiplos CNPJs (SPEs) enfrentam vazamentos de informações, canteiros desconectados e falta de controle.
          </p>
        </div>

        {/* Grid de Dores */}
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Dor 1 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center mb-6">
              <FontAwesomeIcon icon={faBan} className="text-xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Holdings & Múltiplas SPEs</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">
              Planilhas soltas e falta de RLS expõem dados confidenciais e misturam caixas de empresas e empreendimentos diferentes.
            </p>
          </div>

          {/* Dor 2 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center mb-6">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Engenharia vs Financeiro</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">
              O engenheiro no canteiro realiza compras emergenciais de insumos sem o aval imediato do financeiro, gerando furos orçamentários.
            </p>
          </div>

          {/* Dor 3 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center mb-6">
              <FontAwesomeIcon icon={faFolderOpen} className="text-xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Leads & Atendimento Solto</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">
              Contatos chegam por canais diversos e ficam salvos no celular pessoal dos corretores, resultando em perda de histórico e leads esquecidos.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
