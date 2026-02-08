// components/contratos/QuadroResumoContrato.js
"use client";

import { useMemo } from 'react';
import extenso from 'extenso'; // Precisamos do extenso aqui também

// --- Componentes Auxiliares (Copiados do GeradorContrato) ---
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

// --- Funções Auxiliares (Copiadas e adaptadas) ---
const formatDateForDisplay = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

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
        const cleanedCep = entidade.cep.replace(/\D/g, '');
        if (cleanedCep.length === 8) {
            cepFormatado = `CEP: ${cleanedCep.slice(0, 5)}-${cleanedCep.slice(5)}`;
        } else {
            cepFormatado = `CEP: ${entidade.cep}`;
        }
    }
    const parts = [ruaNumeroComplemento, bairro, cidadeEstado, cepFormatado].filter(Boolean);
    return parts.join(', ');
};


// --- COMPONENTE DO QUADRO RESUMO ---
export default function QuadroResumoContrato({ contrato }) {

    // Extrai os dados necessários do contrato com segurança
    const comprador = contrato?.contato;
    const conjuge = contrato?.conjuge;
    const representante = contrato?.representante;
    const empreendimento = contrato?.empreendimento;
    const empresaProprietaria = empreendimento?.empresa_proprietaria_id;
    const produtos = contrato?.produtos || [];
    const corretor = contrato?.corretor;
    const contaSelecionada = contrato?.conta_financeira;
    const isPessoaJuridica = comprador?.personalidade_juridica === 'Pessoa Jurídica';

    // Calcula parcelas (lógica movida para cá)
    const { entrada, parcelasRegulares, parcelaSaldoFinal } = useMemo(() => {
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

    // Calcula resumo (lógica movida para cá)
    const resumoParcelasRegulares = useMemo(() => {
        if (parcelasRegulares.length === 0) return "Nenhuma";
        const primeiraData = [...parcelasRegulares].sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0]?.data_vencimento;
        const dataInicioFormatada = formatDateForDisplay(primeiraData);
        const grupos = parcelasRegulares.reduce((acc, p) => {
            const valor = parseFloat(p.valor_parcela || 0).toFixed(2);
            if (!acc[valor]) acc[valor] = 0; acc[valor]++; return acc;
        }, {});
        const resumoGrupos = Object.entries(grupos).map(([valor, q]) => `${q}x ${formatCurrency(parseFloat(valor))}`).join('; '); // Simplificado
        return `${resumoGrupos}, 1ª em ${dataInicioFormatada || 'N/A'}`;
    }, [parcelasRegulares]);


    // Calcula variáveis do template (lógica movida para cá)
    const unidadesTexto = produtos.map(p => p.unidade).join(', ');
    const vagasGaragemTexto = produtos.map(p => p.vaga_garagem).filter(Boolean).join(', ');
    const matriculasTexto = produtos.map(p => p.matricula).filter(Boolean).join(', ');
    const valorTotalContrato = parseFloat(contrato?.valor_final_venda) || 0;
    const totalParcelasRegulares = parcelasRegulares.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0);
    const valorSaldoFinal = parseFloat(parcelaSaldoFinal?.valor_parcela || 0);
    const percentualEntrada = valorTotalContrato > 0 ? (entrada.valor / valorTotalContrato) * 100 : 0;
    const percentualParcelasRegulares = valorTotalContrato > 0 ? (totalParcelasRegulares / valorTotalContrato) * 100 : 0;
    const percentualSaldoFinal = valorTotalContrato > 0 ? (valorSaldoFinal / valorTotalContrato) * 100 : 0;

    // Se não tiver dados do contrato, não renderiza nada (ou um placeholder)
    if (!contrato) {
        return <div className="text-center text-gray-500 italic p-4">Dados do contrato não disponíveis para o Quadro Resumo.</div>;
    }

    return (
        <>
            <h2 className="text-center font-bold text-lg print:text-base print:mb-4 mb-6 uppercase">
                QUADRO RESUMO DO CONTRATO PARTICULAR <br/>
                DE PROMESSA DE COMPRA E VENDA DE IMÓVEL URBANO
            </h2>

            {/* --- SEÇÃO 1: PARTES --- */}
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="1" titulo="Partes" />
                 <div className="pl-4 print:pl-2">
                     <p className="font-semibold text-sm print:text-xs mt-3 mb-1">1.1 Vendedora:</p>
                     <QuadroLinha label="Razão Social" value={empresaProprietaria?.razao_social || "N/A"} />
                     <QuadroLinha label="CNPJ" value={empresaProprietaria?.cnpj || "N/A"} />
                     <QuadroLinha label="Sede" value={formatarEndereco(empresaProprietaria) || "N/A"} />
                     <QuadroLinha label="Representante(s)" value={empresaProprietaria?.responsavel_legal || "N/A"} />

                     <p className="font-semibold text-sm print:text-xs mt-3 mb-1">1.2 Comprador(a):</p>
                     <QuadroLinha label="Nome / Razão Social" value={comprador?.nome || comprador?.razao_social || 'N/A'}/>

                     {!isPessoaJuridica ? (
                        <>
                             <p className="font-semibold text-sm print:text-xs mt-3 mb-1">1.2.1 Detalhes (Pessoa Física):</p>
                             <QuadroLinha label="CPF" value={comprador?.cpf} />
                             <QuadroLinha label="RG" value={comprador?.rg} />
                             <QuadroLinha label="Profissão" value={comprador?.cargo} />
                             <QuadroLinha label="Nacionalidade" value={comprador?.nacionalidade} />
                             <QuadroLinha label="Estado Civil" value={comprador?.estado_civil} />
                             <QuadroLinha label="Endereço" value={formatarEndereco(comprador)} />
                             <QuadroLinha label="Telefone" value={comprador?.telefones?.[0]?.telefone} />
                             <QuadroLinha label="E-mail" value={comprador?.emails?.[0]?.email} />
                             {conjuge && (
                                 <>
                                     <p className="font-semibold text-sm print:text-xs mt-3 mb-1">1.2.1.1 Cônjuge / Companheiro(a):</p>
                                     <QuadroLinha label="Nome" value={conjuge.nome} />
                                     <QuadroLinha label="CPF" value={conjuge.cpf} />
                                     <QuadroLinha label="RG" value={conjuge.rg} />
                                     <QuadroLinha label="Profissão" value={conjuge.cargo} />
                                     <QuadroLinha label="Nacionalidade" value={conjuge.nacionalidade} />
                                     <QuadroLinha label="Regime de bens" value={contrato.regime_bens} />
                                     <QuadroLinha label="Endereço" value={formatarEndereco(conjuge)} />
                                     <QuadroLinha label="Telefone" value={conjuge.telefones?.[0]?.telefone} />
                                     <QuadroLinha label="E-mail" value={conjuge.emails?.[0]?.email} />
                                 </>
                             )}
                             {representante && (
                                 <>
                                     <p className="font-semibold text-sm print:text-xs mt-3 mb-1">1.2.2 Representante (Pessoa Física):</p>
                                     <QuadroLinha label="Nome" value={representante.nome || representante.razao_social} />
                                     <QuadroLinha label="CPF" value={representante.cpf} />
                                     <QuadroLinha label="RG" value={representante.rg} />
                                     <QuadroLinha label="Endereço" value={formatarEndereco(representante)} />
                                 </>
                             )}
                        </>
                     ) : (
                         <>
                             <p className="font-semibold text-sm print:text-xs mt-3 mb-1">1.2.3 Detalhes (Pessoa Jurídica):</p>
                             <QuadroLinha label="CNPJ" value={comprador?.cnpj} />
                             <QuadroLinha label="Sede" value={formatarEndereco(comprador)} />
                             <QuadroLinha label="Representante Legal" value={comprador?.responsavel_legal} />
                             <QuadroLinha label="Telefone" value={comprador?.telefones?.[0]?.telefone} />
                             <QuadroLinha label="E-mail" value={comprador?.emails?.[0]?.email} />
                         </>
                     )}
                 </div>
             </div>

            {/* --- SEÇÃO 2: OBJETO --- */}
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="2" titulo="Objeto do Contrato:" />
                 <QuadroLinha label="Unidade(s)" value={unidadesTexto || 'N/A'} />
                 <QuadroLinha label="Nº da(s) matrícula(s)" value={matriculasTexto || 'A ser individualizada'} />
                 <QuadroLinha label="Cartório competente" value={empreendimento?.matricula_cartorio || 'N/A'} />
                 <QuadroLinha label="Empreendimento" value={empreendimento?.nome_empreendimento || empreendimento?.nome || 'N/A'} />
                 <QuadroLinha label="Endereço" value={formatarEndereco(empreendimento) || 'N/A'} />
                 <QuadroLinha label="Nº registro memorial" value={empreendimento?.matricula_numero || 'N/A'} />
                 <QuadroLinha label="Ônus sobre o Imóvel" value="Não existe ônus sobre o imóvel." />
             </div>

            {/* --- SEÇÃO 3: VALOR E PAGAMENTO --- */}
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="3" titulo="Valor, Forma de Pagamento e Reajuste:" />
                 <QuadroLinha label="Valor total" value={`${formatCurrency(valorTotalContrato)} (${formatExtenso(valorTotalContrato)})`} />
                 <SubtituloSecao numero="3.1" titulo="Forma de Pagamento:" />
                 <QuadroLinha label="Condições" value="Conforme Plano de Pagamento anexo." />
                 {contaSelecionada && (
                     <QuadroLinha label="Conta bancária p/ pagamentos">
                         <div className="space-y-1 print:text-[8pt]">
                             <p><strong>Banco:</strong> {contaSelecionada.instituicao}</p>
                             <p><strong>Agência:</strong> {contaSelecionada.agencia} / <strong>Conta:</strong> {contaSelecionada.numero_conta}</p>
                             {contaSelecionada.chaves_pix && contaSelecionada.chaves_pix[0] && (<p><strong>PIX ({contaSelecionada.chaves_pix[0].tipo}):</strong> {contaSelecionada.chaves_pix[0].chave}</p>)}
                         </div>
                     </QuadroLinha>
                 )}
                 <QuadroLinha label="Entrada/Sinal" value={`${formatCurrency(entrada.valor)} (${(percentualEntrada > 0 ? `${percentualEntrada.toFixed(2)}%` : '0.00%')})`} />
                 <QuadroLinha label="Parcelas" value={`${formatCurrency(totalParcelasRegulares)} (${(percentualParcelasRegulares > 0 ? `${percentualParcelasRegulares.toFixed(2)}%` : '0.00%')})`} />
                 {parcelaSaldoFinal && (
                     <QuadroLinha label="Saldo Remanescente" value={`${formatCurrency(valorSaldoFinal)} (${(percentualSaldoFinal > 0 ? `${percentualSaldoFinal.toFixed(2)}%` : '0.00%')})`} />
                 )}
                 <SubtituloSecao numero="3.2" titulo="Reajuste:" />
                 <QuadroLinha label="Índice" value={contrato?.indice_reajuste || 'N/A'} />
                 <QuadroLinha label="Periodicidade" value={contrato?.indice_reajuste ? "Conforme cláusulas" : "N/A"} />
             </div>

            {/* --- SEÇÕES 4 a 11 --- */}
            <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="4" titulo="Inadimplemento:" />
                 <QuadroLinha label="Multa" value={`${contrato?.multa_inadimplencia_percentual || 2}%`} />
                 <QuadroLinha label="Juros de mora" value={`${contrato?.juros_mora_inadimplencia_percentual || 1}% a.m.`} />
             </div>
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"><TituloSecao numero="5" titulo="Prazo Conclusão da Obra:" /><QuadroTextoSimples texto={empreendimento?.prazo_entrega || "Conforme cronograma"} /></div>
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4"><TituloSecao numero="6" titulo="Obtenção do Habite-se:" /><QuadroTextoSimples texto={empreendimento?.prazo_entrega ? `Até ${empreendimento.prazo_entrega}` : "Conforme cronograma"} /></div>
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="7" titulo="Corretagem:" />
                 <QuadroLinha label="Houve Corretagem" value={corretor ? 'Sim' : 'Não'} />
                 {corretor && (
                     <div className="pl-4 print:pl-2 mt-2">
                         <QuadroLinha label="Corretor" value={corretor.nome || corretor.razao_social} />
                         <QuadroLinha label="CPF/CNPJ" value={corretor.cpf || corretor.cnpj} />
                         <QuadroLinha label="Valor Comissão" value={formatCurrency(contrato?.valor_comissao_corretagem)} />
                         <QuadroLinha label="% Comissão" value={contrato?.percentual_comissao_corretagem ? `${contrato.percentual_comissao_corretagem.toFixed(2)}%` : 'N/A'} />
                         <QuadroLinha label="Responsável Pgto." value={"Comprador(a)"} />
                         <QuadroLinha label="Forma Pgto." value={contrato?.forma_pagamento_corretagem} />
                     </div>
                 )}
             </div>
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="8" titulo="Cláusula Penal:" />
                 <QuadroLinha label="Percentual" value={`${contrato?.clausula_penal_percentual || 10}% sobre valor do contrato`} />
             </div>
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="9" titulo="Rescisão Contratual:" />
                 <QuadroTextoSimples texto="Vide cláusulas contratuais." />
             </div>
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="10" titulo="Direito ao Arrependimento:" />
                 <QuadroTextoSimples texto="Vide cláusulas contratuais." />
             </div>
             <div className="border border-gray-300 p-4 print:p-2 print:mb-4 mb-4">
                 <TituloSecao numero="11" titulo="Comunicação/Notificação:" />
                  <QuadroTextoSimples texto="Vide cláusulas contratuais e dados cadastrados." />
             </div>
        </>
    );
}