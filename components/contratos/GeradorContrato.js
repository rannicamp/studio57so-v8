// components/contratos/GeradorContrato.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint } from '@fortawesome/free-solid-svg-icons';

// --- Componentes Auxiliares para formatação ---

const QuadroLinha = ({ label, value }) => (
    <div className="flex border-t border-gray-200 py-1">
        <p className="w-1/3 text-sm text-gray-600">{label}:</p>
        <p className="w-2/3 text-sm font-semibold text-gray-800">{value || 'Não informado'}</p>
    </div>
);

const QuadroSecaoTexto = ({ titulo, texto }) => (
    <div className="border border-gray-300 p-4 mb-4">
        <h3 className="font-bold mb-2">{titulo}</h3>
        <div className="text-sm text-gray-800 space-y-1">
            {texto.map((linha, index) => <p key={index}>{linha}</p>)}
        </div>
    </div>
);

// Novo componente para formatar as cláusulas do contrato
const Clausula = ({ titulo, subtitulo, children }) => (
    <div className="mb-6">
        {titulo && <h3 className="text-center font-bold uppercase text-sm mb-3">{titulo}</h3>}
        {subtitulo && <p className="font-bold text-center text-sm mb-3">{subtitulo}</p>}
        <div className="text-sm text-justify space-y-3">
            {children}
        </div>
    </div>
);


export default function GeradorContrato({ contrato }) {

    const comprador = contrato?.contato;
    const conjuge = comprador?.dados_conjuge;
    const vendedora = contrato?.empreendimento?.empresa_proprietaria_id;
    const empreendimento = contrato?.empreendimento;
    const produtos = contrato?.produtos || [];
    const corretor = contrato?.corretor;

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatarEndereco = (entidade) => {
        if (!entidade) return 'Não informado';
        const parts = [entidade.address_street, entidade.address_number, entidade.neighborhood, entidade.city, entidade.state].filter(Boolean);
        return parts.join(', ').replace(/, ([A-Z]{2})$/, '/$1');
    };

    const unidadesTexto = produtos.map(p => p.unidade).join(', ');
    const matriculasTexto = produtos.map(p => p.matricula).join(', ');
    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });

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
                <h2 className="text-center font-bold text-lg mb-4 uppercase">
                    Quadro Resumo do Contrato Particular de Promessa de Compra e Venda de Imóvel Urbano
                </h2>

                {/* --- Quadro Resumo --- */}
                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">1) Partes</h3>
                     <div className="pl-4">
                        <p className="font-semibold text-base mb-2">1.1) Vendedora:</p>
                        <QuadroLinha label="Razão Social" value={vendedora?.razao_social} />
                        <QuadroLinha label="CNPJ" value={vendedora?.cnpj} />
                        <QuadroLinha label="Sede" value={formatarEndereco(vendedora)} />
                        
                        <p className="font-semibold text-base mt-4 mb-2">1.2) Comprador(a):</p>
                        <QuadroLinha label="Nome" value={comprador?.nome || comprador?.razao_social} />
                        <QuadroLinha label="CPF/CNPJ" value={comprador?.cpf || comprador?.cnpj} />
                        <QuadroLinha label="Endereço" value={formatarEndereco(comprador)} />
                        {/* Adicionar mais campos do comprador se necessário */}

                        {conjuge?.nome && (
                            <>
                                <p className="font-semibold text-base mt-4 mb-2">1.3) Cônjuge / Companheiro(a):</p>
                                <QuadroLinha label="Nome" value={conjuge.nome} />
                                <QuadroLinha label="CPF" value={conjuge.cpf} />
                            </>
                        )}
                    </div>
                </div>
                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">2) Objeto do Contrato</h3>
                    <QuadroLinha label="Empreendimento" value={empreendimento?.nome_empreendimento} />
                    <QuadroLinha label="Endereço" value={formatarEndereco(empreendimento)} />
                    <QuadroLinha label="Unidade(s)" value={unidadesTexto} />
                    <QuadroLinha label="Nº da(s) Matrícula(s)" value={matriculasTexto} />
                    <QuadroLinha label="Nº Reg. Memorial de Incorporação" value={empreendimento?.matricula_numero} />
                </div>
                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">3) Valor, Forma de Pagamento e Reajuste</h3>
                    <QuadroLinha label="Valor Total do Contrato" value={formatCurrency(contrato.valor_final_venda)} />
                    {/* Aqui entraria a lógica para exibir os detalhes do plano de pagamento */}
                </div>
                <QuadroSecaoTexto titulo="4) Inadimplemento das parcelas:" texto={[`Multa: ${contrato?.multa_inadimplencia_percentual || 2}% sobre valor vencido e não pago`, `Juros de mora: ${contrato?.juros_mora_inadimplencia_percentual || 1}% sobre valor vencido e não pago`]} />
                <QuadroSecaoTexto titulo="5) Prazo conclusão da obra:" texto={[`O prazo estipulado no cronograma físico-financeiro (${empreendimento?.prazo_entrega || 'N/A'}).`]} />
                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">7) Corretagem:</h3>
                    <QuadroLinha label="Houve Corretagem" value={corretor ? 'Sim' : 'Não'} />
                    {corretor && (
                        <div className="pl-4 mt-2">
                            <p className="font-semibold text-base mb-2">7.1) Caso haja corretagem:</p>
                            <QuadroLinha label="Nome do(a) corretor(a)" value={corretor.nome} />
                            <QuadroLinha label="CPF do(a) corretor(a)" value={corretor.cpf} />
                            <QuadroLinha label="Valor da comissão" value={formatCurrency(contrato.valor_comissao_corretagem)} />
                            <QuadroLinha label="Responsável pelo pagamento" value={"O(A) Comprador(a)"} />
                            <QuadroLinha label="Forma de pagamento" value={contrato.forma_pagamento_corretagem} />
                        </div>
                    )}
                </div>
                <QuadroSecaoTexto titulo="8) Cláusula Penal:" texto={[`Percentual: ${contrato.clausula_penal_percentual || 10}% sobre valor do Imóvel`]} />
                {/* --- Fim do Quadro Resumo --- */}


                {/* ============================================================================================== */}
                {/* INÍCIO DO CORPO DO CONTRATO (CLÁUSULAS)                                                      */}
                {/* ============================================================================================== */}
                <div className="mt-8 pt-8 border-t-2 border-black">
                    <h2 className="text-center font-bold text-lg mb-6 uppercase">
                        PROMESSA PARTICULAR DE COMPRA E VENDA DE IMÓVEL URBANO
                    </h2>
                    <p className="text-sm text-justify mb-6">
                        As partes qualificadas no Quadro Resumo anexo a este Contrato firmam o presente na melhor forma do direito, regendo-se tal relação pelas cláusulas e condições aqui previstas e expressas de forma resumida no Quadro Resumo.
                    </p>

                    <Clausula titulo="Das Considerações Preliminares">
                        <p>I. A VENDEDORA é proprietária do imóvel descrito na Matrícula {empreendimento?.matricula_numero} do Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG, onde está sendo implantado por ela o edifício denominado “{empreendimento?.nome_empreendimento}”, de agora em diante denominado apenas como EMPREENDIMENTO;</p>
                        <p>II. O memorial de incorporação do EMPREENDIMENTO, bem como a instituição de condomínio, encontra-se devidamente registrados na Matrícula-mãe {empreendimento?.matricula_numero} do Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG;</p>
                        <p>III. Todas as unidades privativas, incluindo a(s) adquirida(s) pelo(a) COMPRADOR(A), terão matrículas autônomas, onde será(ão) registrada(s), em momento oportuno, a(s) transferência(s) da(s) propriedade(s) imobiliária(s) pela VENDEDORA;</p>
                        <p>IV. A incorporação encontra-se submetida ao regime de preço global, motivo pelo qual a VENDEDORA está legalmente autorizada a realizar, ainda durante a execução das obras, a alienação das “unidades autônomas futuras” com preço reajustável;</p>
                        <p>V. A construção do EMPREENDIMENTO será realizada pela construtora ARKOS CONSTRUÇÕES LTDA, inscrita no CNPJ sob o nº 47.180.830/0001-01;</p>
                        <p>VI. O patrimônio de afetação da incorporação do EMPREENDIMENTO está em processo de averbação perante o Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG;</p>
                        <p>VII. Ao(À) COMPRADOR(A) foi oportunizado o acesso à Convenção de Condomínio do EMPREENDIMENTO, aos quais se obrigam o(a) COMPRADOR(A), além dos seus inquilinos, ocupantes e possuidores a qualquer título das unidades autônomas e empregados, prestadores de serviços, visitantes e demais pessoas que estejam ligadas, de modo permanente ou transitório, às áreas comuns ou às unidades autônomas do edifício.</p>
                    </Clausula>
                    
                    <Clausula titulo="Das Cláusulas e Condições" subtitulo="DO OBJETO">
                        <p>CLÁUSULA 1º. Constitui objeto do presente contrato a transferência da propriedade da(s) unidade(s) descrita(s) no Quadro Resumo anexo, de forma irrevogável, irretratável e onerosa, mediante o cumprimento das obrigações previstas neste instrumento contratual e no Quadro Resumo.</p>
                        <p>§ 1º. O(A) COMPRADOR(A) tem ciência de que, apesar de o EMPREENDIMENTO encontrar-se documentalmente regular, este ainda passará pela fase de obras, conforme exigência legal, cabendo à VENDEDORA ou à construtora contratada por ela a obrigação de realizar a construção da edificação.</p>
                        <p>§ 2º. A efetiva transferência da propriedade da(a) unidade(s) adquirida(s) pelo(a) COMPRADOR(A) ocorrerá por meio de outorga de Escritura Pública de Compra e Venda ou documento análogo pela VENDEDORA, sendo que tal outorga somente acontecerá após o pagamento de todo o valor pelo(a) COMPRADOR(A).</p>
                        <p>§ 3º. A escolha do Cartório de Notas que outorgará a competente Escritura Pública de Compra e Venda, caberá à VENDEDORA.</p>
                        <p>§ 4º. Caberá ao(à) COMPRADOR(A) arcar com todas as despesas e emolumentos decorrentes da outorga e registro da Escritura Pública de Compra e Venda ou documento análogo, tais como impostos (ITBI) e emolumentos cartorários.</p>
                        <p>§ 5º. A presente compra e venda ocorre na modalidade Ad Corpus, tendo sido oportunizado ao(à) COMPRADOR(A) acesso aos projetos da(s) unidade(s) descrita(s) no Quadro Resumo.</p>
                        <p>§ 6º. O(A) COMPRADOR(A) tem ciência de que as informações constantes no memorial de incorporação, bem como no memorial de vendas, prevalecem sobre as divulgadas nos materiais de marketing, de forma que as tonalidades das cores, as formas e as texturas nas imagens divulgadas nos materiais de marketing são meramente ilustrativas e podem sofrer alterações durante as compatibilizações técnicas, além das vegetações representarem artisticamente a fase adulta das espécies.</p>
                        <p>§ 7º. A VENDEDORA se reserva o direito de troca de materiais e marcas, caso não estejam disponíveis no mercado por material equivalente de padrão e qualidade.</p>
                    </Clausula>

                    <Clausula subtitulo="DO VALOR, DA FORMA DE PAGAMENTO E DO REAJUSTE">
                        <p>CLÁUSULA 2º. Como contrapartida pela transferência da propriedade da(s) unidade(s) adquirida(s), o(a) COMPRADOR(A), caso opte pelo pagamento à vista (item 3.1), pagará à VENDEDORA, o valor previsto no tópico 3 de Quadro Resumo, conforme especificado no mesmo Quadro, sendo necessário a VENDEDORA emitir recibo de quitação para o(a) COMPRADOR(A).</p>
                        <p>CLÁUSULA 3º. Caso o(a) COMPRADOR(A) opte pelo pagamento com recursos próprios e de forma parcelada (item 3.2), deverá pagar à VENDEDORA o valor previsto no tópico 3 do Quadro Resumo, da seguinte maneira: I - A entrada/sinal prevista no Quadro Resumo, devendo o valor ser quitado de forma integral e à vista no prazo também previsto no Quadro Resumo, sendo tal entrada considerada o início do negócio e princípio de pagamento; II - Os demais valores, abatida a entrada/sinal, serão divididos na quantidade de parcelas previstas no Quadro Resumo, onde também está estipulada a data de vencimento de cada uma delas.</p>
                        <p>CLÁUSULA 4º. Optando o(a) COMPRADOR(A) pelo pagamento parcelado, este também deverá observar o exposto no Quadro Resumo, não sendo necessário, entretanto, a VENDEDORA emitir recibo de quitação mensal, sendo suficiente, como meio de prova de quitação, o recibo bancário ou documento análogo, sendo necessária, entretanto, a emissão de recibo de quitação pela VENDEDORA após a realização do pagamento total.</p>
                        <p>CLÁUSULA 5º. Em caso de o(a) COMPRADOR(A) optar pelo pagamento parcelado e se, por qualquer motivo, o valor mencionado no inciso I desta Cláusula não for pago dentro do prazo previsto no Quadro Resumo, o presente instrumento estará rescindido de pleno direito, sendo desnecessária qualquer notificação, ciência ou intimação do(a) COMPRADOR(A) para tal fim, podendo a VENDEDORA alienar para terceiros a(s) unidade(s) objeto deste Contrato.</p>
                        <p>CLÁUSULA 6º. Caso o pagamento venha a acontecer por meio de cheque, a dívida somente estará quitada após a devida compensação bancária deste.</p>
                        <p>CLÁUSULA 7º. Da mesma forma, ocorrendo o pagamento por meio de transferências bancárias e/ou chave PIX, o valor só será considerado pago após a comprovação do crédito do valor na conta bancária prevista no Quadro Resumo.</p>
                        <p>CLÁUSULA 8º. Fica acordado entre as partes que as parcelas assumidas pelo(a) COMPRADOR(A) serão trimestralmente reajustadas na mesma data de celebração deste Contrato, por meio do Índice Nacional de Custo da Construção (INCC), no período correspondente, respeitando o limite mínimo de 5% (cinco por cento) e máximo de 10% (dez por cento).</p>
                        <p>CLÁUSULA 9º. Sendo realizado o pagamento por meio de financiamento bancário (item 3.3), fica estipulado o seguinte: ... (demais itens da cláusula 9)</p>
                    </Clausula>

                    <Clausula subtitulo="DO INADIMPLEMENTO">
                        <p>CLÁUSULA 10º. Não sendo pagas as parcelas mencionadas no Quadro Resumo na data prevista, estas ficarão sujeitas, até o seu respectivo pagamento, à correção monetária pelo índice previsto anteriormente, acrescidas de juros de mora de 1% (um por cento), mais multa no importe de 2% (dois por cento) sobre o valor vencido e não pago.</p>
                        <p>CLÁUSULA 11º. As sanções aqui previstas serão aplicadas automaticamente em caso de inadimplência de qualquer uma das parcelas, não sendo necessária a ocorrência de notificação ou interpelação, judicial ou extrajudicial.</p>
                        <p>§ 1º. Fica assegurado ao(à) COMPRADOR(A) o prazo de 15 (quinze) dias corridos, contados do dia posterior ao vencimento da parcela, para purgar a mora.</p>
                        <p>§ 2º. A aplicação da penalidade aqui expressa não impede o exercício do direito de retomada da posse pela VENDEDORA em razão do inadimplemento de 3 (três) parcelas, consecutivas ou não, nos termos da Cláusula 13ª deste contrato, bem como a rescisão contratual também prevista neste contrato na Cláusula 22ª.</p>
                    </Clausula>

                    <Clausula subtitulo="DA COMISSÃO DE CORRETAGEM">
                        <p>CLÁUSULA 12º. Em razão da intermediação do negócio aqui firmado, fica estabelecido o pagamento da comissão de corretagem pelo(a) COMPRADOR(A), conforme dados previstos no Quadro Resumo.</p>
                        <p>§ 1º. O(A) COMPRADOR(A) declara expressamente a sua ciência sobre o não englobamento da comissão de corretagem ao preço da(s) unidade(s) imobiliária(s) objeto deste contrato, tratando-se de valores distintos e independentes entre si.</p>
                        <p>§ 2º. Em caso de inadimplência do(a) COMPRADOR(A) no que diz respeito ao pagamento da comissão aqui prevista, a VENDEDORA não se responsabiliza pelo pagamento, cabendo ao corretor tomar as devidas providências judiciais e extrajudiciais que entender serem necessárias.</p>
                    </Clausula>

                    {/* Adicione as demais cláusulas aqui, seguindo o mesmo padrão... */}
                </div>


                {/* --- Seção de Assinaturas --- */}
                <div className="text-center mt-12 mb-12">
                    <p>Governador Valadares/MG, {dataAtual}.</p>
                </div>
                <div className="space-y-12">
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto"></div>
                        <p className="mt-2 font-semibold">{vendedora?.razao_social}</p>
                        <p className="text-xs">VENDEDORA</p>
                    </div>
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto"></div>
                        <p className="mt-2 font-semibold">{comprador?.nome || comprador?.razao_social}</p>
                        <p className="text-xs">COMPRADOR(A)</p>
                    </div>
                    {conjuge?.nome && (
                        <div className="text-center">
                            <div className="border-b-2 border-black w-3/4 mx-auto"></div>
                            <p className="mt-2 font-semibold">{conjuge.nome}</p>
                            <p className="text-xs">CÔNJUGE OU COMPANHEIRO(A)</p>
                        </div>
                    )}
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto pt-8"></div>
                        <p className="mt-2 font-semibold">TESTEMUNHA 1</p>
                    </div>
                    <div className="text-center">
                        <div className="border-b-2 border-black w-3/4 mx-auto pt-8"></div>
                        <p className="mt-2 font-semibold">TESTEMUNHA 2</p>
                    </div>
                </div>
            </div>
        </div>
    );
}