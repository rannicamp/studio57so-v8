// components/contratos/GeradorContrato.js
"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faSpinner } from '@fortawesome/free-solid-svg-icons';
import extenso from 'extenso';

// --- Componentes Auxiliares para formatação ---

const QuadroLinha = ({ label, value, children, className = '' }) => {
    return (
        <div className={`flex border-t border-gray-200 py-1 ${className}`}>
            <p className="w-1/3 text-sm text-gray-600">{label}:</p>
            <div className="w-2/3 text-sm font-semibold text-gray-800">{value || children || <span>&nbsp;</span>}</div>
        </div>
    );
};

const QuadroTextoSimples = ({ texto, className = '' }) => (
    <p className={`text-sm text-gray-800 ${className}`}>{texto}</p>
);

const TituloSecao = ({ numero, titulo }) => (
    <h3 className="font-bold mb-2 mt-4 text-base">{numero}) {titulo}</h3>
);

const SubtituloSecao = ({ numero, titulo }) => (
    <p className="font-semibold text-sm my-3">{numero}) {titulo}</p>
);


export default function GeradorContrato({ contrato }) {

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

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    
    const formatExtenso = (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '';
        }
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
    
    // =================================================================================
    // CÁLCULO DO SALDO REMANESCENTE
    // O PORQUÊ: Subtraímos do valor total do contrato o valor da entrada e o valor
    // de todas as outras parcelas para encontrar o saldo que não foi coberto
    // pelo plano de pagamento.
    // =================================================================================
    const saldoRemanescente = valorTotalContrato - entrada.valor - totalOutrasParcelas;
    const percentualSaldoRemanescente = valorTotalContrato > 0 ? (saldoRemanescente / valorTotalContrato) * 100 : 0;

    const resumoOutrasParcelas = useMemo(() => {
        if (outrasParcelas.length === 0) {
            return "Nenhuma";
        }
        const grupos = outrasParcelas.reduce((acc, p) => {
            const valor = parseFloat(p.valor_parcela || 0);
            if (!acc[valor]) {
                acc[valor] = 0;
            }
            acc[valor]++;
            return acc;
        }, {});

        return Object.entries(grupos).map(([valor, quantidade]) => 
            `${quantidade} parcelas de ${formatCurrency(parseFloat(valor))} (${formatExtenso(parseFloat(valor))})`
        ).join('; ');

    }, [outrasParcelas]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in">
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
                <h2 className="text-center font-bold text-lg mb-6 uppercase">
                    QUADRO RESUMO DO CONTRATO PARTICULAR <br/>
                    DE PROMESSA DE COMPRA E VENDA DE IMÓVEL URBANO
                </h2>

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

                        {/* --- Seção Pessoa Física --- */}
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
                        
                        {/* --- Seção Representante --- */}
                        <p className="font-semibold text-sm mt-3 mb-1">1.2.2 Quando Pessoa Física e Representada por Outra:</p>
                        <QuadroLinha label="Nome do Representante" value={representante?.nome || representante?.razao_social} />
                        <QuadroLinha label="CPF do Representante" value={representante?.cpf} />
                        <QuadroLinha label="RG do Representante" value={representante?.rg} />
                        <QuadroLinha label="Endereço" value={formatarEndereco(representante)} />
                        <QuadroLinha label="Data da procuração" />

                        {/* --- Seção Pessoa Jurídica --- */}
                        <p className="font-semibold text-sm mt-3 mb-1">1.2.3 Quando Pessoa Jurídica:</p>
                        <QuadroLinha label="CNPJ" value={isPessoaJuridica ? comprador?.cnpj : ''} />
                        <QuadroLinha label="Sede" value={isPessoaJuridica ? formatarEndereco(comprador) : ''} />
                        <QuadroLinha label="Nome completo do(a) sócio(a)-administrador(a)" value={isPessoaJuridica ? comprador?.responsavel_legal : ''} />
                        <QuadroLinha label="Contato 1 (telefone/WhatsApp)" value={isPessoaJuridica ? comprador?.telefones?.[0]?.telefone : ''} />
                        <QuadroLinha label="Contato 2 (e-mail)" value={isPessoaJuridica ? comprador?.emails?.[0]?.email : ''} />
                        <QuadroLinha label="CPF do(a) sócio(a)-administrador(a)" value={isPessoaJuridica ? comprador?.cpf_responsavel_legal : ''} />
                        <QuadroLinha label="RG do(a) sócio(a)-administrador(a)" value={isPessoaJuridica ? comprador?.rg_responsavel_legal : ''} />
                        <QuadroLinha label="Contato 1 do(a) sócio(a)-administrador(a) (telefone/WhatsApp)" value={isPessoaJuridica ? comprador?.telefone_responsavel_legal : ''} />
                        <QuadroLinha label="Contato 2 do(a) sócio(a)-administrador(a) (e-mail)" value={isPessoaJuridica ? comprador?.email_responsavel_legal : ''} />
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
                    
                    {/* LINHAS NOVAS ADICIONADAS AQUI */}
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
                
                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="4" titulo="Inadimplemento das parcelas:" />
                    <QuadroTextoSimples texto="Multa: 2% (dois por cento) sobre valor vencido e não pago" />
                    <QuadroTextoSimples texto="Juros de mora: 1% (um por cento) sobre valor vencido e não pago" />
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                   <TituloSecao numero="5" titulo="Prazo conclusão da obra:" />
                   <QuadroTextoSimples texto="O prazo estipulado no cronograma físico-financeiro." />
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                   <TituloSecao numero="6" titulo="Termo final para obtenção do auto de conclusão das obras:" />
                   <QuadroTextoSimples texto="O prazo estipulado no cronograma físico-financeiro." />
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="7" titulo="Corretagem:" />
                    <QuadroLinha label="Houve Corretagem" value={corretor ? '( X ) sim ( ) não' : '( ) sim ( X ) não'} />
                    {corretor && (
                        <div className="pl-4 mt-2">
                            <p className="font-semibold text-sm my-2">7.1) Caso haja corretagem:</p>
                            <QuadroLinha label="Nome do(a) corretor(a)" value={corretor.nome} />
                            <QuadroLinha label="CPF do(a) corretor(a)" value={corretor.cpf} />
                            <QuadroLinha label="RG do(a) corretor(a)" value={corretor.rg} />
                            <QuadroLinha label="Endereço do(a) corretor(a)" value={formatarEndereco(corretor)} />
                            <QuadroLinha label="Contato 1 do(a) corretor(a) (telefone/WhatsApp)" value={corretor?.telefone} />
                            <QuadroLinha label="Contato 2 do(a) corretor(a) (e-mail)" value={corretor?.email} />
                            <QuadroLinha label="Valor da comissão" value={formatCurrency(contrato.valor_comissao_corretagem)} />
                            <QuadroLinha label="Responsável pelo pagamento da comissão de corretagem" value={"o(a) comprador(a)"} />
                            <QuadroLinha label="Forma de pagamento" value={contrato.forma_pagamento_corretagem} />
                            <QuadroLinha label="Conta bancária em caso de transferência" />
                            <QuadroLinha label="Parcelas mensais (quantidade e valor)" />
                            <QuadroLinha label="Data de vencimento das parcelas" />
                        </div>
                    )}
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="8" titulo="Cláusula Penal:" />
                    <QuadroTextoSimples texto="Percentual: 10% sobre valor do Imóvel" />
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="9" titulo="Rescisão Contratual:" />
                    <div className="pl-4 space-y-3">
                        <div>
                           <p className="font-semibold text-sm mb-1">9.1) Por Mútuo Acordo Entre as Partes:</p>
                           <QuadroTextoSimples texto="Penalidade: Retenção de todo o valor líquido recebido pela Vendedora, inclusive a comissão de corretagem, sem aplicação da Cláusula Penal. Salvo acordo contrário entre as partes." />
                        </div>
                        <div>
                            <p className="font-semibold text-sm mb-1">9.2) Por inadimplemento de 3 parcelas (consecutivas ou não) ou por descumprimento das cláusulas contratuais que impeça o prosseguimento do negócio:</p>
                            <QuadroTextoSimples texto="Penalidades: Aplicação da Cláusula Penal mencionada no tópico anterior; Retenção pela Vendedora de 25% de todo o valor pago pelo(a) Comprador(a); Retenção da comissão de corretagem." />
                            <QuadroTextoSimples texto="Em caso de já ter ocorrido a imissão na posse: Aplicação das penalidades mencionadas nesse tópico; Retomada da posse pela Vendedora; Pagamentos dos impostos incidentes sobre o imóvel até a data da retomada da posse; Pagamentos das taxas condominiais incidentes sobre o imóvel até a data da retomada da posse; Pagamento do percentual de 0,5% sobre o valor atualizado deste contrato, pro rata die, por ter usufruído do imóvel." className="mt-2" />
                        </div>
                    </div>
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="10" titulo="Direito ao Arrependimento:" />
                    <QuadroTextoSimples texto="Será possível o desfazimento do contrato dentro de 7 dias contados da assinatura do presente instrumento, quando celebrado em estandes de vendas ou fora da sede do incorporador ou do estabelecimento comercial." />
                    <QuadroTextoSimples texto="Da devolução dos valores: Ocorrendo o exercício do direito de arrependimento, todo o valor pago será devolvido, inclusive a comissão de corretagem." className="mt-2 font-semibold" />
                    <QuadroLinha label="Prazo para devolução" value="15 dias, contados do aviso do arrependimento." />
                    <QuadroLinha label="Conta para eventual devolução" />
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <TituloSecao numero="11" titulo="Comunicação/Notificação entre as partes:" />
                    <div className="pl-4">
                        <p className="font-semibold text-sm my-2">11.1) Vendedora:</p>
                        <QuadroLinha label="Responsável" value="RANNIERE CAMPOS MENDES" />
                        <QuadroLinha label="Endereço" value="Avenida Rio Doce, nº 1825, Loja, Sala A, Ilha dos Araújos, Governador Valadares/MG, CEP 35.020-500" />
                        <QuadroLinha label="E-mail" value="contato@studio57.arq.br" />
                        <QuadroLinha label="Telefone/Whatsapp" value="+55 33 99943-4841" />
                        
                        <p className="font-semibold text-sm my-2 mt-4">11.2) Comprador(a):</p>
                        <QuadroLinha label="Responsável" value={comprador?.nome || comprador?.razao_social} />
                        <QuadroLinha label="Endereço" value={formatarEndereco(comprador)} />
                        <QuadroLinha label="E-mail" value={comprador?.emails?.[0]?.email} />
                        <QuadroLinha label="Telefone/Whatsapp" value={comprador?.telefones?.[0]?.telefone} />
                    </div>
                </div>

                {/* --- SEPARAÇÃO DE PÁGINA PARA O CONTRATO DETALHADO --- */}
                <div className="mt-8 pt-8 border-t-2 border-black" style={{ pageBreakBefore: 'always' }}>
                    <h2 className="text-center font-bold text-lg mb-6 uppercase">
                        PROMESSA PARTICULAR DE COMPRA E VENDA DE IMÓVEL URBANO
                    </h2>
                    {/* ... (O restante do contrato detalhado com as cláusulas permanece o mesmo) ... */}
                    <p className="text-sm text-justify mb-6">
                        As partes qualificadas no Quadro Resumo anexo a este Contrato firmam o presente na melhor forma do direito, regendo-se tal relação pelas cláusulas e condições aqui previstas e expressas de forma resumida no Quadro Resumo.
                    </p>
                    {/* ... Cole aqui o restante das cláusulas que foram omitidas para abreviar ... */}
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
                    {conjuge?.nome && (
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
            </div>
        </div>
    );
}