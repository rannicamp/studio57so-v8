// Local do Arquivo: components/contratos/GeradorContrato.js
"use client";

// Imports necessários (simplificados)
import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
// import extenso from 'extenso'; // Não é mais necessário aqui
// import ClausulasContrato from './ClausulasContrato'; // Já removido
import PlanoPagamentoPrint from './PlanoPagamentoPrint';
import QuadroResumoContrato from './QuadroResumoContrato'; // <-- 1. IMPORTA O NOVO COMPONENTE

// --- Função fetchClausulasModelo (mantida) ---
const fetchClausulasModelo = async (supabase, modeloId) => {
    // ... (código inalterado) ...
     if (!modeloId) return null;
    const { data, error } = await supabase
        .from('modelos_contrato')
        .select('clausulas_html')
        .eq('id', modeloId)
        .single();
    if (error) {
        console.error("Erro ao buscar cláusulas do modelo:", error);
        throw new Error("Não foi possível carregar as cláusulas do modelo selecionado.");
    }
    return data?.clausulas_html || null;
};

// --- COMPONENTE PRINCIPAL SIMPLIFICADO ---
export default function GeradorContrato({ contrato, modeloContratoId }) {
    const supabase = createClient();
    const { user, userData } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Estados/Memos para Signatário e GeradoPor (mantidos, pois são usados no PlanoPagamentoPrint)
    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';
    const anoAtual = new Date().getFullYear(); // Mantido para data de assinatura

     useEffect(() => {
        // ... (busca proprietários - mantido) ...
         const fetchInitialData = async () => {
            if (!organizacaoId) return;
            const { data: proprietariosData } = await supabase
                .from('usuarios')
                .select('id, nome, sobrenome, funcionario:funcionarios(cpf), funcoes!inner(nome_funcao)')
                .eq('organizacao_id', organizacaoId)
                .eq('funcoes.nome_funcao', 'Proprietário');

            setProprietarios(proprietariosData || []);

            if (isUserProprietario && user) {
                setSelectedSignatoryId(user.id);
            } else if (proprietariosData?.length > 0) {
                setSelectedSignatoryId(proprietariosData[0].id);
            }
        };
        fetchInitialData();
    }, [supabase, user, isUserProprietario, organizacaoId]);

    const selectedSignatory = useMemo(() => {
        // ... (lógica signatário - mantido) ...
        if (!selectedSignatoryId || proprietarios.length === 0) return null;
        const signatory = proprietarios.find(p => p.id === selectedSignatoryId);
        return signatory
            ? {
                name: `${signatory.nome || ''} ${signatory.sobrenome || ''}`.trim(),
                cpf: signatory.funcionario?.cpf || 'N/A'
              }
            : null;
    }, [selectedSignatoryId, proprietarios]);
    const geradoPor = useMemo(() => userData ? `${userData.nome} ${userData.sobrenome}` : '', [userData]);

    // --- Lógicas de cálculo de parcelas/resumo REMOVIDAS daqui ---
    // const { entrada, parcelasRegulares, ... } = useMemo(...)
    // const resumoParcelasRegulares = useMemo(...)

    // --- useQuery para Cláusulas (mantido) ---
    const {
        data: clausulasHtml,
        isLoading: isLoadingClausulas,
        isError: isErrorClausulas,
        error: errorClausulas
    } = useQuery({
        queryKey: ['clausulasContrato', modeloContratoId],
        queryFn: () => fetchClausulasModelo(supabase, modeloContratoId),
        enabled: !!modeloContratoId,
        staleTime: 1000 * 60 * 5,
    });

    // Estado de Loading (simplificado)
    const isLoading = !contrato || (!!modeloContratoId && isLoadingClausulas);

    if (isLoading) {
        return ( <div className="flex justify-center items-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> );
    }

    // --- Variáveis de formatação REMOVIDAS (exceto as usadas nas assinaturas/plano) ---
    // const comprador = ...
    // const conjuge = ...
    // const formatCurrency = ...
    // const formatExtenso = ...
    // const formatarEndereco = ...

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in">

            {/* --- BLOCO DE ESTILOS ATUALIZADO --- */}
            <style jsx global>{`
                /* Estilos de Impressão (para esconder o layout) */
                @media print {
                    /* 1. Esconde TUDO por padrão */
                    body * {
                        visibility: hidden;
                    }

                    /* 2. FORÇA o esconderijo de toasts (biblioteca sonner) */
                    [data-sonner-toast] {
                        visibility: hidden !important;
                        display: none !important;
                    }

                    /* 3. Mostra SOMENTE nossa área e seus filhos */
                    .printable-area,
                    .printable-area * {
                        visibility: visible;
                    }

                    /* 4. Reposiciona a área para a página inteira */
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding-left: 1.5cm; /* <-- SUA NOVA BORDA DE 1.5CM */
                        box-sizing: border-box; /* <-- Para garantir que o padding não estoure a largura */
                    }
                }
                
                /* Estilos específicos das Cláusulas (do seu arquivo original) */
                .clauses-content p { 
                    /* ... */ 
                }
                .clauses-content strong { 
                    /* ... */ 
                }
            `}</style>

            {/* Botão de Imprimir (Mantido) */}
            <div className="print:hidden flex justify-between items-center mb-6 pb-4 border-b">
                {/* ... */}
                 <h3 className="text-xl font-bold text-gray-800">Pré-visualização do Contrato</h3>
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPrint} /> Gerar PDF / Imprimir
                </button>
            </div>

            {/* Área Imprimível (A CLASSE 'printable-area' É O SEGREDO) */}
            <div className="printable-area bg-white p-8 font-serif print:p-0">

                {/* --- 2. RENDERIZA O NOVO COMPONENTE QUADRO RESUMO --- */}
                <QuadroResumoContrato contrato={contrato} />

                {/* --- SEÇÃO DAS CLÁUSULAS DINÂMICAS (Mantida) --- */}
                <div className="mt-8 pt-8 border-t-2 border-black print:mt-4 print:pt-4" style={{ pageBreakBefore: 'always' }}>
                    <h2 className="text-center font-bold text-lg print:text-base print:mb-4 mb-6 uppercase"> PROMESSA PARTICULAR DE COMPRA E VENDA DE IMÓVEL URBANO </h2>
                    {/* Renderização Condicional das Cláusulas */}
                    {isLoadingClausulas ? ( /* Loading */ <div className="text-center py-6">...</div>
                    ) : isErrorClausulas ? ( /* Erro */ <div className="text-center py-6 text-red-600">...</div>
                    ) : !modeloContratoId ? ( /* Sem Modelo */ <div className="text-center py-6 text-yellow-700">...</div>
                    ): clausulasHtml ? ( /* Cláusulas OK */
                        <div
                            className="prose prose-sm max-w-none text-justify clauses-content print:prose-xs"
                            dangerouslySetInnerHTML={{ __html: clausulasHtml }}
                        />
                    ) : ( /* Modelo Vazio */ <div className="text-center py-6 text-gray-500">...</div>
                    )}
                </div>

                {/* Assinaturas e Anexo (Mantidos) */}
                <div className="text-center mt-12 mb-12 print:mt-8 print:mb-8"> <p className="print:text-xs">Governador Valadares/MG, ____ de _______________ de {anoAtual}.</p> </div>
                <div className="space-y-12 print:space-y-8">
                     {/* Assinaturas (Requer 'empresaProprietaria', 'comprador', 'conjuge') - Revisar se dados estão disponíveis */}
                     <div className="text-center"> <div className="border-b-2 border-black w-3/4 mx-auto mb-2"></div> <p className="font-semibold print:text-xs">{contrato?.empreendimento?.empresa_proprietaria_id?.razao_social || 'NOME EMPRESA VENDEDORA'}</p> <p className="text-xs print:text-[8pt]">VENDEDORA</p> </div>
                     <div className="text-center"> <div className="border-b-2 border-black w-3/4 mx-auto mb-2"></div> <p className="mt-2 font-semibold print:text-xs">{contrato?.contato?.nome || contrato?.contato?.razao_social}</p> <p className="text-xs print:text-[8pt]">COMPRADOR(A)</p> </div>
                     {contrato?.conjuge?.nome && !(contrato?.contato?.personalidade_juridica === 'Pessoa Jurídica') && ( <div className="text-center"> <div className="border-b-2 border-black w-3/4 mx-auto mb-2"></div> <p className="mt-2 font-semibold print:text-xs">{contrato.conjuge.nome}</p> <p className="text-xs print:text-[8pt]">CÔNJUGE OU COMPANHEIRO(A)</p> </div> )}
                     <div className="text-center"> <div className="border-b-2 border-black w-3/4 mx-auto pt-8 mb-2 print:pt-4"></div> <p className="mt-2 font-semibold print:text-xs">TESTEMUNHA 1</p> </div>
                     <div className="text-center"> <div className="border-b-2 border-black w-3/4 mx-auto pt-8 mb-2 print:pt-4"></div> <p className="mt-2 font-semibold print:text-xs">TESTEMUNHA 2</p> </div>
                </div>
                <div style={{ pageBreakBefore: 'always' }}>
                    <PlanoPagamentoPrint contrato={contrato} signatory={selectedSignatory} geradoPor={geradoPor} />
                </div>
            </div>
        </div>
    );
}