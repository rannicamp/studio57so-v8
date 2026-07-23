// Caminho: app/(landingpages)/elo57/components/McpSection.js
'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTerminal, faRobot, faDatabase, faCodeBranch } from '@fortawesome/free-solid-svg-icons';
import { OpenAI, Claude, Antigravity } from '@lobehub/icons';

export default function McpSection() {
  const [mounted, setMounted] = useState(false);
  const [terminalStep, setTerminalStep] = useState(0);

  useEffect(() => {
    setMounted(true);

    // Loop de animação do terminal mockup
    const interval = setInterval(() => {
      setTerminalStep((prev) => (prev + 1) % 5);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <section 
      id="mcp" 
      className="relative min-h-screen flex flex-col justify-center bg-white px-6 py-16 md:py-24 overflow-hidden"
    >
      {/* Divisor superior sutil */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-slate-100"></div>

      <div className="max-w-7xl mx-auto w-full grid md:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Lado Esquerdo: Conteúdo explicativo (5 colunas) */}
        <div className="md:col-span-5 flex flex-col justify-center">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            Protocolo de IA Aberto
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-slate-900 mb-6 leading-tight tracking-tight">
            Liberdade total.<br/>
            Conecte a IA <span className="font-bold text-slate-950">que você quiser.</span>
          </h2>
          <p className="text-lg text-slate-650 mb-6 font-light leading-relaxed">
            O Elo 57 é pioneiro ao implementar uma camada nativa de <strong className="font-semibold text-slate-900">MCP (Model Context Protocol)</strong>. Isso desacopla a inteligência artificial do sistema principal: você não fica preso a uma IA embutida. Use o seu agente de inteligência artificial de preferência para controlar o seu ERP de forma autônoma.
          </p>

          {/* Marcas dos Agentes Homologados (Soltos na tela, justificados à largura do texto) */}
          <div className="mb-10 w-full mt-2">
            <div className="flex justify-between items-center w-full select-none gap-2">
              
              {/* Google Antigravity */}
              <div className="flex items-center gap-3 group">
                <div className="w-9 h-9 flex items-center justify-center shrink-0 transform group-hover:scale-105 transition-transform duration-300">
                  <Antigravity.Color size={36} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 group-hover:text-slate-950 transition-colors">
                    Antigravity
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">Google</span>
                </div>
              </div>

              {/* ChatGPT */}
              <div className="flex items-center gap-3 group">
                <div className="w-9 h-9 flex items-center justify-center shrink-0 transform group-hover:rotate-12 transition-transform duration-300">
                  <OpenAI.Avatar size={36} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 group-hover:text-slate-950 transition-colors">
                    ChatGPT
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">OpenAI</span>
                </div>
              </div>

              {/* Claude */}
              <div className="flex items-center gap-3 group">
                <div className="w-9 h-9 flex items-center justify-center shrink-0 transform group-hover:scale-105 transition-transform duration-300">
                  <Claude.Color size={36} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-800 group-hover:text-slate-950 transition-colors">
                    Claude
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">Anthropic</span>
                </div>
              </div>

            </div>
          </div>

          {/* Cards de Recursos do MCP */}
          <div className="grid gap-4">
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex gap-4 items-start hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faDatabase} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-950 mb-0.5 text-sm">Carga de Dados Automatizada</h3>
                <p className="text-xs text-slate-500 font-light leading-normal">
                  Forneça planilhas CSV antigas ou extratos brutos para o seu agente. Ele os interpretará e fará lançamentos financeiros e de estoque automáticos.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex gap-4 items-start hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faRobot} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-950 mb-0.5 text-sm">Automação de Rotinas via Prompt</h3>
                <p className="text-xs text-slate-500 font-light leading-normal">
                  Crie contatos no CRM, autorize vales de funcionários e consulte KPIs de engenharia pedindo diretamente ao seu assistente por texto ou voz.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex gap-4 items-start hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faCodeBranch} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-950 mb-0.5 text-sm">Protocolo Seguro e Autorizado</h3>
                <p className="text-xs text-slate-500 font-light leading-normal">
                  Nosso servidor MCP expõe funções seguras e auditadas pelo Supabase, respeitando rigorosamente as regras de permissão da sua holding.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Simulador de Terminal do MCP (7 colunas) */}
        <div className="md:col-span-7 flex flex-col justify-center">
          
          {/* Caixa de Terminal Premium (Light Theme) */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            
            {/* Barra superior do terminal */}
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-[#f25a2f]/20 flex items-center justify-center text-[8px] text-[#f25a2f] font-bold">×</div>
                <div className="w-3.5 h-3.5 rounded-full bg-slate-200"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-slate-200"></div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase font-semibold">
                MCP-SERVER // ELO57_AGENT
              </div>
              <div className="w-8"></div>
            </div>

            {/* Corpo do Terminal (Fontes mono, cores de console light) */}
            <div className="p-6 font-mono text-xs leading-relaxed min-h-[340px] flex flex-col justify-between text-slate-800">
              <div className="space-y-4">
                
                {/* Linha 1: Prompt do Usuário */}
                <div className="flex items-start gap-2.5">
                  <span className="text-slate-400 font-bold">user:~$</span>
                  <span className="text-slate-900 font-medium">
                    "Agente, leia a planilha de despesas de obras do canteiro deste mês e lance tudo no financeiro do Elo 57."
                  </span>
                </div>

                {/* Linha 2: Pensamento da IA (Passo 1+) */}
                {terminalStep >= 1 && (
                  <div className="text-slate-650 bg-orange-50/70 p-3 rounded-lg border border-orange-100 animate-fadeIn">
                    <p className="text-[#f25a2f] font-bold text-[10px] uppercase mb-1">
                      💭 PENSAMENTO DA IA (AGENTE)
                    </p>
                    <p className="font-light text-slate-600">
                      Lendo planilha despesas_canteiro.csv... Detectadas 3 despesas pendentes. 
                      Vou convertê-las em chamadas de ferramenta no servidor MCP do Elo 57 para garantir as validações de segurança e sinais.
                    </p>
                  </div>
                )}

                {/* Linha 3: Executando as RPCs do Banco (Passo 2+) */}
                {terminalStep >= 2 && (
                  <div className="space-y-1.5 pl-4 border-l border-slate-200 animate-fadeIn">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2 font-bold">
                      ⚙️ CHAMADAS DE FERRAMENTA (MCP SERVER)
                    </p>
                    
                    <div className="flex items-center justify-between text-slate-650">
                      <span>▸ elo57_lancar_despesa(valor=-1500.00, categoria="Insumos", descricao="Areia")</span>
                      <span className="text-emerald-600 font-bold shrink-0">✅ ID #2481</span>
                    </div>

                    {terminalStep >= 3 && (
                      <div className="flex items-center justify-between text-slate-650 animate-fadeIn">
                        <span>▸ elo57_lancar_despesa(valor=-8450.00, categoria="Mão de Obra", descricao="Alvenaria")</span>
                        <span className="text-emerald-600 font-bold shrink-0">✅ ID #2482</span>
                      </div>
                    )}

                    {terminalStep >= 4 && (
                      <div className="flex items-center justify-between text-slate-650 animate-fadeIn">
                        <span>▸ elo57_lancar_despesa(valor=-3200.00, categoria="Logística", descricao="Caçamba")</span>
                        <span className="text-emerald-600 font-bold shrink-0">✅ ID #2483</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Saída de Sucesso do Console */}
              <div className="border-t border-slate-200/80 pt-4 mt-4 flex items-center justify-between">
                <div>
                  {terminalStep === 4 ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-2 animate-pulse">
                      <span>●</span> Lançamentos consolidados com sucesso!
                    </span>
                  ) : (
                    <span className="text-slate-400 animate-pulse">
                      Status: Executando fluxo de automação...
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  Respeitando RLS / Org ID: 2
                </div>
              </div>

            </div>

          </div>

          {/* Legenda/Apoio abaixo do terminal */}
          <p className="text-slate-400 text-[11px] font-mono mt-3 text-center">
            Qualquer agente compatível com MCP pode consumir e operar o Elo 57 através de credenciais de API.
          </p>

        </div>

      </div>
    </section>
  );
}
