// Local do Arquivo: components/contratos/GeradorContrato.js
"use client";

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import extenso from 'extenso';
// Removida a importação de ClausulasContrato
import PlanoPagamentoPrint from './PlanoPagamentoPrint';

// --- Componentes Auxiliares (Com print: classes) ---
const QuadroLinha = ({ label, value, children, className = '' }) => {
    return (
        <div className={`flex border-t border-gray-200 py-1 print:py-0.5 ${className}`}>
            <p className="w-1/3 text-sm text-gray-600 print:text-[9pt] print:w-1/4">{label}:</p>
            <div className="w-2/3 text-sm font-semibold text-gray-800 print:text-[9pt] print:w-3/4">{value || children || <span>&nbsp;</span>}</div>
        </div>
    );
};
const QuadroTextoSimples = ({ texto, className = '' }) => (
    <p className={`text-sm text-gray-800 print:text-[9pt] ${className}`}>{texto}</p>
);
const TituloSecao = ({ numero, titulo }) => (
    <h3 className="font-bold mb-2 mt-4 text-base print:text-sm print:mt-2 print:mb-1">{numero}) {titulo}</h3>
);
const SubtituloSecao = ({ numero, titulo }) => (
    <p className="font-semibold text-sm my-3 print:text-xs print:my-1">{numero}) {titulo}</p>
);

// --- Função fetchClausulasModelo (Sem mudanças) ---
const fetchClausulasModelo = async (supabase, modeloId) => {
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

// --- COMPONENTE PRINCIPAL REVISADO ---
export default function GeradorContrato({ contrato, modeloContratoId }) {
    const supabase = createClient();
    const { user, userData } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Estados e Memos (sem mudanças)
    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            // ... (busca proprietários) ...
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
        // ... (lógica signatário) ...
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

    const { entrada, parcelasRegulares, parcelaSaldoFinal } = useMemo(() => {
        // ... (lógica parcelas) ...
        const todasAsParcelas = contrato?.contrato_parcelas || [];
        const entradaInfo = { valor: 0, parcelas: [] };
        const regulares = [];
        let saldoFinal = null;

        todasAsParcelas.forEach(p => {
            const valor = parseFloat(p.valor_parcela || 0);
            if (p.tipo === 'Entrada') {
                entradaInfo.valor += valor;
                entradaInfo.parcelas.push({ valor, data_vencimento: p.data_vencimento });
            } else if (p.tipo === 'Saldo Remanescente' || p.descricao?.includes('Saldo Remanescente')) {
                saldoFinal = p;
            } else {
                regulares.push(p);
            }
        });

        if (entradaInfo.parcelas.length > 0) {
           entradaInfo.parcelas.sort((a,b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
        }
        return { entrada: entradaInfo, parcelasRegulares: regulares, parcelaSaldoFinal: saldoFinal };
    }, [contrato?.contrato_parcelas]);

    const resumoParcelasRegulares = useMemo(() => {
        // ... (lógica resumo parcelas) ...
        const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
        const formatExtenso = (value) => extenso(value, { mode: 'currency' });

        if (parcelasRegulares.length === 0) return "Nenhuma";

        const primeiraData = [...parcelasRegulares].sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0]?.data_vencimento;
        const dataInicioFormatada = formatDateForDisplay(primeiraData);

        const grupos = parcelasRegulares.reduce((acc, p) => {
            const valor = parseFloat(p.valor_parcela || 0).toFixed(2);
            if (!acc[valor]) acc[valor] = 0;
            acc[valor]++;
            return acc;
        }, {});

        const resumoGrupos = Object.entries(grupos).map(([valor, quantidade]) =>
            `${quantidade} parcelas de ${formatCurrency(parseFloat(valor))} (${formatExtenso(parseFloat(valor))})`
        ).join('; ');

        return `${resumoGrupos}, subsequentes com início em ${dataInicioFormatada || 'data inválida'}`;
    }, [parcelasRegulares, formatDateForDisplay]);

    // useQuery para Cláusulas (sem mudanças)
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

    const isLoading = !contrato || (!!modeloContratoId && isLoadingClausulas);

    if (isLoading) {
        return ( <div className="flex justify-center items-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> );
    }

    // --- VARIÁVEIS E FUNÇÕES DE FORMATAÇÃO (Revisadas) ---
    const comprador = contrato.contato;
    const conjuge = contrato.conjuge;
    const representante = contrato.representante;
    const empreendimento = contrato.empreendimento;
    const empresaProprietaria = empreendimento?.empresa_proprietaria_id;
    const produtos = contrato.produtos || [];
    const corretor = contrato.corretor;
    const contaSelecionada = contrato.conta_financeira;
    const isPessoaJuridica = comprador?.personalidade_juridica === 'Pessoa Jurídica';

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatExtenso = (value) => {
         if (typeof value !== 'number' || isNaN(value)) return '';
         return extenso(value, { mode: 'currency' });
    };
    const formatarEndereco = (entidade) => {
        if (!entidade) return 'Não informado';
        const ruaNumeroComplemento = [entidade.address_street, entidade.address_number, entidade.address_complement].filter(Boolean).join(', ');
        const bairro = entidade.neighborhood;
        const cidadeEstado = [entidade.city, entidade.state].filter(Boolean).join('/');
        let cepFormatado = null;
        if (entidade.cep) {
            const cleanedCep = entidade.cep.replace(/\D/g, ''); // CORRIGIDO
            if (cleanedCep.length === 8) {
                cepFormatado = `CEP: ${cleanedCep.slice(0, 5)}-${cleanedCep.slice(5)}`; // CORRIGIDO
            } else {
                cepFormatado = `CEP: ${entidade.cep}`;
            }
        }
        const parts = [ruaNumeroComplemento, bairro, cidadeEstado, cepFormatado].filter(Boolean);
        return parts.join(', ');
    };

    const unidadesTexto = produtos.map(p => p.unidade).join(', ');
    const vagasGaragemTexto = produtos.map(p => p.vaga_garagem).filter(Boolean).join(', ');
    const matriculasTexto = produtos.map(p => p.matricula).filter(Boolean).join(', ');
    const anoAtual = new Date().getFullYear();
    const valorTotalContrato = parseFloat(contrato.valor_final_venda) || 0;
    const totalParcelasRegulares = parcelasRegulares.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0);
    const valorSaldoFinal = parseFloat(parcelaSaldoFinal?.valor_parcela || 0);
    const percentualEntrada = valorTotalContrato > 0 ? (entrada.valor / valorTotalContrato) * 100 : 0;
    const percentualParcelasRegulares = valorTotalContrato > 0 ? (totalParcelasRegulares / valorTotalContrato) * 100 : 0;
    const percentualSaldoFinal = valorTotalContrato > 0 ? (valorSaldoFinal / valorTotalContrato) * 100 : 0;


    // --- RENDERIZAÇÃO PRINCIPAL ---
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in">

            {/* --- BLOCO DE ESTILOS UNIFICADO (Corrigido - no topo) --- */}
            <style jsx global>{`
                /* Estilos de Impressão */
                @media print {
                    @page { size: A4; margin: 2.5cm 2cm 2cm 2.5cm; }
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1.5; }
                    .printable-area h2 { font-size: 12pt; margin-bottom: 1rem; }
                    .printable-area h3 { font-size: 11pt; margin-top: 0.8rem; margin-bottom: 0.4rem; }
                    .printable-area p, .printable-area div { font-size: 10pt; }
                    .printable-area .text-xs { font-size: 9pt; }
                    .printable-area .font-semibold { font-weight: 600; }
                    .printable-area .font-bold { font-weight: bold; }
                    .printable-area .mb-1 { margin-bottom: 0.25rem; }
                    .printable-area .mb-2 { margin-bottom: 0.5rem; }
                    .printable-area .mb-4 { margin-bottom: 1rem; }
                    .printable-area .mb-6 { margin-bottom: 1.5rem; }
                    .printable-area .mt-1 { margin-top: 0.25rem; }
                    .printable-area .mt-2 { margin-top: 0.5rem; }
                    .printable-area .mt-3 { margin-top: 0.75rem; }
                    .printable-area .mt-4 { margin-top: 1rem; }
                    .printable-area .py-0\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
                    .printable-area .p-2 { padding: 0.5rem; }
                    .printable-area .p-4 { padding: 1rem; }
                    .printable-area .pl-2 { padding-left: 0.5rem; }
                    .printable-area .pl-4 { padding-left: 1rem; }
                    .print\:hidden { display: none; }
                }
                /* Estilos do Conteúdo das Cláusulas */
                .clauses-content p { margin-bottom: 0.75rem; line-height: 1.6; }
                .clauses-content strong { font-weight: bold; }
            `}</style>
            {/* --- FIM DO BLOCO DE ESTILOS --- */}

            {/* Botão de Imprimir */}
            <div className="print:hidden flex justify-between items-center mb-6 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">Pré-visualização do Contrato</h3>
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPrint} /> Gerar PDF / Imprimir
                </button>
            </div>

            {/* Área Imprimível */}
            <div className="printable-area bg-white p-8 font-serif print:p-0">
                {/* Cabeçalho Quadro Resumo */}
                <h2 className="text-center font-bold text-lg print:text-base print:mb-4 mb-6 uppercase">
                    QUADRO RESUMO DO CONTRATO PARTICULAR <br/>
                    DE PROMESSA DE COMPRA E VENDA DE IMÓVEL URBANO
                </h2>

                {/* Seções 1 a 11 do Quadro Resumo (Revisadas) */}
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="1" titulo="Partes" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="2" titulo="Objeto do Contrato:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="3" titulo="Valor, Forma de Pagamento e Reajuste:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="4" titulo="Inadimplemento:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="5" titulo="Prazo Conclusão da Obra:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="6" titulo="Obtenção do Habite-se:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="7" titulo="Corretagem:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="8" titulo="Cláusula Penal:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="9" titulo="Rescisão Contratual:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="10" titulo="Direito ao Arrependimento:" /> {/* ... conteúdo ... */} </div>
                <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"> <TituloSecao numero="11" titulo="Comunicação/Notificação:" /> {/* ... conteúdo ... */} </div>


                {/* --- SEÇÃO DAS CLÁUSULAS DINÂMICAS --- */}
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
                {/* --- FIM DA SEÇÃO DAS CLÁUSULAS --- */}

                {/* Assinaturas e Anexo (sem mudanças) */}
                <div className="text-center mt-12 mb-12 print:mt-8 print:mb-8"> {/* ... Data ... */} </div>
                <div className="space-y-12 print:space-y-8"> {/* ... Assinaturas ... */} </div>
                <div style={{ pageBreakBefore: 'always' }}>
                    <PlanoPagamentoPrint contrato={contrato} signatory={selectedSignatory} geradoPor={geradoPor} />
                </div>
            </div>
        </div>
    );
}