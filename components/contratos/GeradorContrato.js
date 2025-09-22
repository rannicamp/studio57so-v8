// components/contratos/GeradorContrato.js
"use client";

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faSpinner } from '@fortawesome/free-solid-svg-icons';
import extenso from 'extenso';
import ClausulasContrato from './ClausulasContrato';
import PlanoPagamentoPrint from './PlanoPagamentoPrint';

// --- Componentes Auxiliares (sem alterações) ---
const QuadroLinha = ({ label, value, children, className = '' }) => (
    <div className={`flex border-t border-gray-200 py-1 ${className}`}>
        <p className="w-1/3 text-sm text-gray-600">{label}:</p>
        <div className="w-2/3 text-sm font-semibold text-gray-800">{value || children || <span>&nbsp;</span>}</div>
    </div>
);
const QuadroTextoSimples = ({ texto, className = '' }) => <p className={`text-sm text-gray-800 ${className}`}>{texto}</p>;
const TituloSecao = ({ numero, titulo }) => <h3 className="font-bold mb-2 mt-4 text-base">{numero}) {titulo}</h3>;
const SubtituloSecao = ({ numero, titulo }) => <p className="font-semibold text-sm my-3">{numero}) {titulo}</p>;


export default function GeradorContrato({ contrato }) {
    const supabase = createClient();
    const { user, userData } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';
    
    useEffect(() => {
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


    if (!contrato) {
        return (
            <div className="flex justify-center items-center p-10 bg-white rounded-lg shadow-md border">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                <span className="ml-4 text-gray-600">Carregando dados do contrato...</span>
            </div>
        );
    }

    const comprador = contrato?.contato;
    const conjuge = contrato?.conjuge;
    const representante = contrato?.representante;
    const empreendimento = contrato?.empreendimento;
    const produtos = contrato?.produtos || [];
    const corretor = contrato?.corretor;
    const contaSelecionada = contrato?.conta_financeira;
    const isPessoaJuridica = comprador?.personalidade_juridica === 'Pessoa Jurídica';

    // --- Funções de formatação (sem alterações) ---
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    const formatExtenso = (value) => {
        if (typeof value !== 'number' || isNaN(value)) return '';
        return extenso(value, { mode: 'currency' });
    };
    const formatarEndereco = (entidade) => {
        if (!entidade) return 'Não informado';
        const endereco = [ entidade.address_street, entidade.address_number, entidade.neighborhood, entidade.city, entidade.state ];
        const parts = endereco.filter(Boolean);
        return parts.join(', ').replace(/, ([A-Z]{2})$/, '/$1');
    };

    const unidadesTexto = produtos.map(p => p.unidade).join(', ');
    const vagasGaragemTexto = produtos.map(p => p.vaga_garagem).filter(Boolean).join(', ');
    const matriculasTexto = produtos.map(p => p.matricula).join(', ');
    const anoAtual = new Date().getFullYear();
    
    const { entrada, outrasParcelas, totalOutrasParcelas } = useMemo(() => {
        const parcelas = contrato?.contrato_parcelas || [];
        const entradaInfo = { valor: 0, parcelas: [] };
        const outras = [];
        let totalOutras = 0;
        parcelas.forEach(p => {
            const valor = parseFloat(p.valor_parcela || 0);
            if (p.tipo === 'Entrada') {
                entradaInfo.valor += valor;
                entradaInfo.parcelas.push({ valor, data_vencimento: p.data_vencimento });
            } else {
                outras.push(p);
                totalOutras += valor;
            }
        });
        if (entradaInfo.parcelas.length > 0) {
           entradaInfo.parcelas.sort((a,b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
        }
        return { entrada: entradaInfo, outrasParcelas: outras, totalOutrasParcelas: totalOutras };
    }, [contrato?.contrato_parcelas]);
    
    const valorTotalContrato = parseFloat(contrato.valor_final_venda) || 0;
    const percentualEntrada = valorTotalContrato > 0 ? (entrada.valor / valorTotalContrato) * 100 : 0;
    const percentualOutrasParcelas = valorTotalContrato > 0 ? (totalOutrasParcelas / valorTotalContrato) * 100 : 0;
    const saldoRemanescente = valorTotalContrato - entrada.valor - totalOutrasParcelas;
    const percentualSaldoRemanescente = valorTotalContrato > 0 ? (saldoRemanescente / valorTotalContrato) * 100 : 0;

    const resumoOutrasParcelas = useMemo(() => {
        if (outrasParcelas.length === 0) return "Nenhuma";
        const grupos = outrasParcelas.reduce((acc, p) => {
            const valor = parseFloat(p.valor_parcela || 0);
            if (!acc[valor]) acc[valor] = 0;
            acc[valor]++;
            return acc;
        }, {});
        return Object.entries(grupos).map(([valor, quantidade]) => 
            `${quantidade} parcelas de ${formatCurrency(parseFloat(valor))} (${formatExtenso(parseFloat(valor))})`
        ).join('; ');
    }, [outrasParcelas]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in">
            {/* ============================================================================================== */}
            {/* CÓDIGO MÁGICO PARA IMPRESSÃO CORRETA - AGORA COM A LOGO! */}
            {/* ============================================================================================== */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin-top: 3cm;
                        margin-left: 3cm;
                        margin-right: 2cm;
                        margin-bottom: 2cm;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    .print-header-logo {
                        position: fixed; /* Repete em todas as páginas */
                        top: 0.5cm; /* Distância do topo da PÁGINA */
                        right: 2cm; /* Alinha com a margem direita do texto */
                        width: 4cm;
                        height: auto;
                        opacity: 0.8;
                        z-index: -1; /* JOGA A IMAGEM PARA TRÁS DO TEXTO */
                    }
                }
            `}</style>
            <div className="print:hidden flex justify-between items-center mb-6 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">Pré-visualização do Contrato</h3>
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPrint} />
                    Gerar PDF / Imprimir
                </button>
            </div>

            {/* --- Início da Área Imprimível --- */}
            <div className="printable-area bg-white p-8 font-serif">
                <img 
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG" 
                    alt="Logo Studio 57"
                    className="print-header-logo"
                />
                
                <h2 className="text-center font-bold text-lg mb-6 uppercase">
                    QUADRO RESUMO DO CONTRATO PARTICULAR <br/>
                    DE PROMESSA DE COMPRA E VENDA DE IMÓVEL URBANO
                </h2>

                {/* Restante do contrato... (sem alterações) */}
                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="1" titulo="Partes" />
                    <div className="pl-4">
                        <p className="font-semibold text-sm mt-3 mb-1">1.1 Vendedora:</p>
                        <QuadroLinha label="Razão Social" value="STUDIO 57 INCORPORAÇÕES LTDA" />
                        <QuadroLinha label="CNPJ" value="41.464.589/0001-66" />
                        <QuadroLinha label="Sede" value="Avenida Rio Doce, nº 1825, Loja, Sala A, Ilha dos Araújos, Governador Valadares/MG, CEP 35.020-500" />
                        <QuadroLinha label="Representante" value="RANNIERE CAMPOS MENDES E/OU IGOR MONTE ALTO REZENDE" />

                        <p className="font-semibold text-sm mt-3 mb-1">1.2 Nome completo do(a) comprador(a):</p>
                        <QuadroTextoSimples texto={comprador?.nome || comprador?.razao_social || ' '}/>

                        <p className="font-semibold text-sm mt-3 mb-1">1.2.1 Quando Pessoa Física:</p>
                        <QuadroLinha label="CPF" value={!isPessoaJuridica ? comprador?.cpf : ''} />
                        <QuadroLinha label="RG" value={!isPessoaJuridica ? comprador?.rg : ''} />
                        <QuadroLinha label="Profissão" value={!isPessoaJuridica ? comprador?.cargo : ''} />
                        <QuadroLinha label="Estado Civil" value={!isPessoaJuridica ? comprador?.estado_civil : ''} />
                        <QuadroLinha label="Endereço" value={!isPessoaJuridica ? formatarEndereco(comprador) : ''} />
                        <QuadroLinha label="Contato 1 (telefone/WhatsApp)" value={!isPessoaJuridica ? comprador?.telefones?.[0]?.telefone : ''} />
                        <QuadroLinha label="Contato 2 (e-mail)" value={!isPessoaJuridica ? comprador?.emails?.[0]?.email : ''} />
                        <QuadroLinha label="Nome completo do(a) cônjuge ou companheiro(a)" value={!isPessoaJuridica ? conjuge?.nome : ''} />
                        <QuadroLinha label="CPF do(a) cônjuge ou companheiro(a)" value={!isPessoaJuridica ? conjuge?.cpf : ''} />
                        <QuadroLinha label="RG do(a) cônjuge ou companheiro(a)" value={!isPessoaJuridica ? conjuge?.rg : ''} />
                        <QuadroLinha label="Regime de bens" value={!isPessoaJuridica ? contrato?.regime_bens : ''} />
                        <QuadroLinha label="Endereço do(a) cônjuge ou companheiro(a)" value={!isPessoaJuridica ? formatarEndereco(conjuge) : ''} />
                        <QuadroLinha label="Contato 1 do(a) cônjuge ou companheiro(a) (telefone/WhatsApp)" value={!isPessoaJuridica ? conjuge?.telefones?.[0]?.telefone : ''} />
                        <QuadroLinha label="Contato 2 do(a) cônjuge ou companheiro(a) (e-mail)" value={!isPessoaJuridica ? conjuge?.emails?.[0]?.email : ''} />
                        
                        <p className="font-semibold text-sm mt-3 mb-1">1.2.2 Quando Pessoa Física e Representada por Outra:</p>
                        <QuadroLinha label="Nome do Representante" value={!isPessoaJuridica && representante ? (representante.nome || representante.razao_social) : ''} />
                        <QuadroLinha label="CPF do Representante" value={!isPessoaJuridica && representante ? representante.cpf : ''} />
                        <QuadroLinha label="RG do Representante" value={!isPessoaJuridica && representante ? representante.rg : ''} />
                        <QuadroLinha label="Endereço" value={!isPessoaJuridica && representante ? formatarEndereco(representante) : ''} />
                        <QuadroLinha label="Data da procuração" />

                        <p className="font-semibold text-sm mt-3 mb-1">1.2.3 Quando Pessoa Jurídica:</p>
                        <QuadroLinha label="CNPJ" value={isPessoaJuridica ? comprador?.cnpj : ''} />
                        <QuadroLinha label="Sede" value={isPessoaJuridica ? formatarEndereco(comprador) : ''} />
                        <QuadroLinha label="Nome completo do(a) sócio(a)-administrador(a)" value={isPessoaJuridica ? comprador?.responsavel_legal : ''} />
                        <QuadroLinha label="Contato 1 (telefone/WhatsApp)" value={isPessoaJuridica ? comprador?.telefones?.[0]?.telefone : ''} />
                        <QuadroLinha label="Contato 2 (e-mail)" value={isPessoaJuridica ? comprador?.emails?.[0]?.email : ''} />
                    </div>
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="2" titulo="Objeto do Contrato:" />
                    <QuadroLinha label="Unidade(s)" value={unidadesTexto} />
                    <QuadroLinha label="Nº da(s) matrícula(s) autônoma(s)" value={matriculasTexto} />
                    <QuadroLinha label="Vaga da Garagem" value={vagasGaragemTexto} />
                    <QuadroLinha label="Cartório competente" value="Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG" />
                    <QuadroLinha label="Empreendimento" value={empreendimento?.nome_empreendimento} />
                    <QuadroLinha label="Endereço" value={formatarEndereco(empreendimento)} />
                    <QuadroLinha label="Nº registro memorial de incorporação" value={empreendimento?.matricula_numero} />
                    <QuadroLinha label="Existência de ônus sobre o Imóvel" value="Não existe ônus sobre o imóvel." />
                </div>
                
                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="3" titulo="Valor, Forma de Pagamento e Reajuste:" />
                    <QuadroLinha label="Valor total" value={`${formatCurrency(contrato.valor_final_venda)} (${formatExtenso(contrato.valor_final_venda)})`} />
                    
                    <SubtituloSecao numero="3.1" titulo="Totalidade paga à vista:" />
                    <QuadroLinha label="Conta bancária" />
                    <QuadroLinha label="Data" />

                    <SubtituloSecao numero="3.2" titulo="Valor pago com recursos próprios e de forma parcelada:" />
                    <QuadroLinha label="Forma de pagamento" value="Conforme discriminado abaixo" />
                    {contaSelecionada && (
                        <QuadroLinha label="Conta bancária em caso de transferência">
                            <div className="space-y-1">
                                <p><strong>Banco:</strong> {contaSelecionada.instituicao}</p>
                                <p><strong>Agência:</strong> {contaSelecionada.agencia} / <strong>Conta:</strong> {contaSelecionada.numero_conta}</p>
                                {contaSelecionada.chaves_pix && contaSelecionada.chaves_pix[0] && (
                                     <p><strong>PIX ({contaSelecionada.chaves_pix[0].tipo}):</strong> {contaSelecionada.chaves_pix[0].chave}</p>
                                )}
                            </div>
                        </QuadroLinha>
                    )}
                    
                    <QuadroLinha label="Valor da entrada/do sinal">
                        <div>
                            <p className="font-bold">
                                {formatCurrency(entrada.valor)} ({formatExtenso(entrada.valor)})
                                {entrada.parcelas.length > 1 && 
                                    ` em ${entrada.parcelas.length} parcelas de ${formatCurrency(entrada.parcelas[0]?.valor)} (${formatExtenso(entrada.parcelas[0]?.valor)})`
                                }
                            </p>
                            {entrada.parcelas.length > 1 && (
                                <div className="pl-4 text-xs italic mt-1 font-normal">
                                    {entrada.parcelas.map((p, index) => (
                                        <p key={index}>{formatDateForDisplay(p.data_vencimento)} – {formatCurrency(p.valor)}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </QuadroLinha>
                    
                    {entrada.parcelas.length === 1 && (
                       <QuadroLinha label="Data do pagamento da entrada" value={formatDateForDisplay(entrada.parcelas[0]?.data_vencimento)} />
                    )}

                    <QuadroLinha label="Percentual do valor pago da entrada/sinal sobre o valor total do contrato" value={percentualEntrada > 0 ? `${percentualEntrada.toFixed(2)}%` : ''}/>
                    <QuadroLinha label="Parcelas mensais (quantidade, valor e data de vencimento)" value={resumoOutrasParcelas}/>
                    <QuadroLinha label="Percentual do valor das parcelas mensais sobre o valor total do contrato" value={percentualOutrasParcelas > 0 ? `${percentualOutrasParcelas.toFixed(2)}%` : ''} />
                    
                    {Math.abs(saldoRemanescente) > 0.01 && (
                        <>
                            <QuadroLinha label="Saldo Remanescente" value={`${formatCurrency(saldoRemanescente)} (${formatExtenso(saldoRemanescente)})`}/>
                            <QuadroLinha label="Percentual do Saldo Remanescente sobre o valor total do contrato" value={percentualSaldoRemanescente > 0 ? `${percentualSaldoRemanescente.toFixed(2)}%` : ''} />
                        </>
                    )}

                    <QuadroLinha label="Forma de reajuste/atualização das parcelas" value="a cada trimestre" />
                    <QuadroLinha label="Índice de reajuste/atualização das parcelas" value="Índice Nacional de Custo da Construção (INCC)" />
                    <QuadroLinha label="Taxa de juros em caso de atrasos" />
                    <QuadroLinha label="A taxa de juros será" value="( ) mensal ( ) anual" />
                    <QuadroLinha label="A taxa de juros será" value="( ) nominal ( ) efetiva" />
                    <QuadroLinha label="Prazo de incidência da taxa de juros" />
                    <QuadroLinha label="Período de amortização da taxa de juros" />
                    <QuadroLinha label="Sistema de amortização da taxa de juros" />
                    <QuadroLinha label="Condições especiais" />

                    <SubtituloSecao numero="3.3" titulo="Valor pago com financiamento bancário:" />
                    <p className='italic text-sm mt-2 mb-1'>3.3.1) Valor pago com recursos próprios:</p>
                    <QuadroLinha label="Forma de pagamento" />
                    <QuadroLinha label="Conta bancária em caso de transferência" />
                    <QuadroLinha label="Valor" />
                    <QuadroLinha label="Data do pagamento" />
                    <QuadroLinha label="Percentual do valor pago sobre o valor total do contrato" />
                    <QuadroLinha label="Parcelas mensais (quantidade, valor e data de vencimento)" />
                    <QuadroLinha label="Percentual do valor das parcelas mensais sobre o valor total do contrato" />
                    <QuadroLinha label="Forma de reajuste/atualização das parcelas" value="a cada trimestre" />
                    <QuadroLinha label="Índice de reajuste/atualização das parcelas" value="Índice Nacional de Custo da Construção (INCC)" />
                    <QuadroLinha label="Taxa de juros em caso de atrasos" />
                    <QuadroLinha label="A taxa de juros será" value="( ) mensal ( ) anual" />
                    <QuadroLinha label="A taxa de juros será" value="( ) nominal ( ) efetiva" />
                    <QuadroLinha label="Prazo de incidência da taxa de juros" />
                    <QuadroLinha label="Período de amortização da taxa de juros" />
                    <QuadroLinha label="Sistema de amortização da taxa de juros" />
                    <QuadroLinha label="Condições especiais" />
                    <p className='italic text-sm mt-4 mb-1'>3.3.2) Valor pago com recursos financiados:</p>
                    <QuadroLinha label="Valor" />
                    <QuadroLinha label="Instituição Bancária" />
                    <QuadroLinha label="Percentual do valor pago sobre o valor total do contrato" />
                </div>
                
                {/* ... O resto do documento (Cláusulas, assinaturas, etc.) ... */}
                
                <div className="mt-8 pt-8 border-t-2 border-black" style={{ pageBreakBefore: 'always' }}>
                    <h2 className="text-center font-bold text-lg mb-6 uppercase">
                        PROMESSA PARTICULAR DE COMPRA E VENDA DE IMÓVEL URBANO
                    </h2>
                    <ClausulasContrato />
                </div>

                <div className="text-center mt-12 mb-12">
                    <p>Governador Valadares/MG, ____ de _______________ de {anoAtual}.</p>
                </div>
                <div className="space-y-12">
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto mb-2"></div>
                        <p className="font-semibold">STUDIO 57 INCORPORAÇÕES LTDA</p>
                        <p className="text-xs">VENDEDORA</p>
                    </div>
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto mb-2"></div>
                        <p className="mt-2 font-semibold">{comprador?.nome || comprador?.razao_social}</p>
                        <p className="text-xs">COMPRADOR(A)</p>
                    </div>
                    {conjuge?.nome && !isPessoaJuridica && (
                        <div className="text-center">
                            <div className="border-b-2 border-black w-3/4 mx-auto mb-2"></div>
                            <p className="mt-2 font-semibold">{conjuge.nome}</p>
                            <p className="text-xs">CÔNJUGE OU COMPANHEIRO(A)</p>
                        </div>
                    )}
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto pt-8 mb-2"></div>
                        <p className="mt-2 font-semibold">TESTEMUNHA 1</p>
                    </div>
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto pt-8 mb-2"></div>
                        <p className="mt-2 font-semibold">TESTEMUNHA 2</p>
                    </div>
                </div>

                <div style={{ pageBreakBefore: 'always' }}>
                    <PlanoPagamentoPrint 
                        contrato={contrato} 
                        signatory={selectedSignatory}
                        geradoPor={geradoPor}
                    />
                </div>
            </div>
        </div>
    );
}