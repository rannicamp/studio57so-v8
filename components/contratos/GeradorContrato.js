// components/contratos/GeradorContrato.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint } from '@fortawesome/free-solid-svg-icons';

// --- Componentes Auxiliares para formatação ---

const QuadroLinha = ({ label, value, fullWidthValue = false, emptyLines = 1 }) => {
    const emptySpace = Array(emptyLines).fill(0).map((_, i) => <span key={i}>&nbsp;</span>).reduce((acc, curr) => <>{acc}{curr}</>, <></>);
    if (fullWidthValue) {
        return (
            <div className="flex border-t border-gray-200 py-1">
                <p className="w-full text-sm font-semibold text-gray-800">{value || emptySpace}</p>
            </div>
        );
    }
    return (
        <div className="flex border-t border-gray-200 py-1">
            <p className="w-1/3 text-sm text-gray-600">{label}:</p>
            <p className="w-2/3 text-sm font-semibold text-gray-800">{value || emptySpace}</p>
        </div>
    );
};


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
        {subtitulo && <p className="font-bold text-sm mb-3">{subtitulo}</p>}
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
        const endereco = [
            entidade.address_street,
            entidade.address_number,
            entidade.neighborhood,
            entidade.city,
            entidade.state
        ];

        const parts = endereco.filter(Boolean);
        return parts.join(', ').replace(/, ([A-Z]{2})$/, '/$1');
    };

    const unidadesTexto = produtos.map(p => p.unidade).join(', ');
    const vagasGaragemTexto = produtos.map(p => p.vaga_garagem).filter(Boolean).join(', ');
    const matriculasTexto = produtos.map(p => p.matricula).join(', ');
    const anoAtual = new Date().getFullYear();


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

                {/* ============================================================================================== */}
                {/* SEÇÃO 1: PARTES                                                                                */}
                {/* ============================================================================================== */}
                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">1) Partes</h3>
                    <div className="pl-4">
                        <p className="font-semibold text-base mb-2">1.1 Vendedora:</p>
                        <QuadroLinha label="Vendedora" value="STUDIO 57 INCORPORAÇÕES LTDA" />
                        <QuadroLinha label="CNPJ" value="41.464.589/0001-66" />
                        <QuadroLinha label="Sede" value="Avenida Rio Doce, nº 1825, Loja, Sala A, Ilha dos Araújos, Governador Valadares/MG, CEP 35.020-500" />
                        <QuadroLinha label="Representante" value="RANNIERE CAMPOS MENDES E/OU IGOR MONTE ALTO REZENDE" />

                        <p className="font-semibold text-base mt-4 mb-2">1.2 Nome completo do(a) comprador(a):</p>
                        <QuadroLinha value={comprador?.nome || comprador?.razao_social} fullWidthValue={true} />

                        {/* --- Seção Pessoa Física --- */}
                        <p className="font-semibold text-base mt-4 mb-2">1.2.1 Quando Pessoa Física:</p>
                        <QuadroLinha label="CPF" value={comprador?.cpf} />
                        <QuadroLinha label="RG" value={comprador?.rg} />
                        <QuadroLinha label="Profissão" value={comprador?.cargo} />
                        <QuadroLinha label="Estado Civil" value={comprador?.estado_civil} />
                        {/* CORREÇÃO AQUI: Removi a verificação de 'tipo_contato' que estava impedindo a exibição */}
                        <QuadroLinha label="Endereço" value={formatarEndereco(comprador)} />
                        <QuadroLinha label="Contato 1 (telefone/WhatsApp)" value={comprador?.telefones?.[0]?.telefone} />
                        <QuadroLinha label="Contato 2 (e-mail)" value={comprador?.emails?.[0]?.email} />
                        
                        <p className="font-semibold text-base mt-4 mb-2">Nome completo do(a) cônjuge ou companheiro(a):</p>
                        <QuadroLinha value={conjuge?.nome} fullWidthValue={true} />
                        <QuadroLinha label="CPF do(a) cônjuge ou companheiro(a)" value={conjuge?.cpf} />
                        <QuadroLinha label="RG do(a) cônjuge ou companheiro(a)" value={conjuge?.rg} />
                        <QuadroLinha label="Regime de bens" value={comprador?.regime_bens} />
                        <QuadroLinha label="Endereço do(a) cônjuge ou companheiro(a)" value={formatarEndereco(conjuge)} />
                        <QuadroLinha label="Contato 1 do(a) cônjuge ou companheiro(a) (telefone/WhatsApp)" value={conjuge?.telefones?.[0]?.telefone} />
                        <QuadroLinha label="Contato 2 do(a) cônjuge ou companheiro(a) (e-mail)" value={conjuge?.emails?.[0]?.email} />

                        {/* --- Seção Representante --- */}
                        <p className="font-semibold text-base mt-4 mb-2">1.2.2 Quando Pessoa Física e Representada por Outra:</p>
                        <QuadroLinha label="CPF do Representante" />
                        <QuadroLinha label="RG do Representante" />
                        <QuadroLinha label="Endereço" />
                        <QuadroLinha label="Data da procuração" />

                        {/* --- Seção Pessoa Jurídica --- */}
                        <p className="font-semibold text-base mt-4 mb-2">1.2.3 Quando Pessoa Jurídica:</p>
                        <QuadroLinha label="CNPJ" value={comprador?.cnpj} />
                        <QuadroLinha label="Sede" value={formatarEndereco(comprador)} />
                        <QuadroLinha label="Nome completo do(a) sócio(a)-administrador(a)" value={comprador?.responsavel_legal} />
                        <QuadroLinha label="Contato 1 (telefone/WhatsApp)" value={comprador?.telefones?.[0]?.telefone} />
                        <QuadroLinha label="Contato 2 (e-mail)" value={comprador?.emails?.[0]?.email} />
                        <QuadroLinha label="CPF do(a) sócio(a)-administrador(a)" value={comprador?.cpf_responsavel_legal} />
                        <QuadroLinha label="RG do(a) sócio(a)-administrador(a)" value={comprador?.rg_responsavel_legal} />
                        <QuadroLinha label="Contato 1 do(a) sócio(a)-administrador(a) (telefone/WhatsApp)" value={comprador?.telefone_responsavel_legal} />
                        <QuadroLinha label="Contato 2 do(a) sócio(a)-administrador(a) (e-mail)" value={comprador?.email_responsavel_legal} />
                    </div>
                </div>


                {/* O RESTANTE DO CÓDIGO PERMANECE IDÊNTICO E COMPLETO */}
                
                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">2) Objeto do Contrato:</h3>
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
                    <h3 className="font-bold mb-2">3) Valor, Forma de Pagamento e Reajuste:</h3>
                    <QuadroLinha label="Valor total" value={formatCurrency(contrato.valor_final_venda)} />
                    <p className='font-semibold text-base mt-4 mb-2'>3.1) Totalidade paga à vista:</p>
                    <QuadroLinha label="Conta bancária" />
                    <QuadroLinha label="Data" />
                    <p className='font-semibold text-base mt-4 mb-2'>3.2) Valor pago com recursos próprios e de forma parcelada:</p>
                    <QuadroLinha label="Forma de pagamento" />
                    <QuadroLinha label="Conta bancária em caso de transferência" />
                    <QuadroLinha label="Valor da entrada/do sinal" />
                    <QuadroLinha label="Data do pagamento da entrada" />
                    <QuadroLinha label="Percentual do valor pago da entrada/sinal sobre o valor total do contrato" />
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

                    <p className='font-semibold text-base mt-4 mb-2'>3.3) Valor pago com financiamento bancário:</p>
                    <p className='italic text-base mt-2 mb-2'>3.3.1) Valor pago com recursos próprios:</p>
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

                    <p className='italic text-base mt-4 mb-2'>3.3.2) Valor pago com recursos financiados:</p>
                    <QuadroLinha label="Valor" />
                    <QuadroLinha label="Instituição Bancária" />
                    <QuadroLinha label="Percentual do valor pago sobre o valor total do contrato" />
                </div>


                <QuadroSecaoTexto titulo="4) Inadimplemento das parcelas:" texto={[`Multa: 2% (dois por cento) sobre valor vencido e não pago`, `Juros de mora: 1% (um por cento) sobre valor vencido e não pago`]} />
                <QuadroSecaoTexto titulo="5) Prazo conclusão da obra:" texto={[`O prazo estipulado no cronograma físico-financeiro.`]} />
                <QuadroSecaoTexto titulo="6) Termo final para obtenção do auto de conclusão das obras:" texto={[`O prazo estipulado no cronograma físico-financeiro.`]} />

                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">7) Corretagem:</h3>
                    <QuadroLinha label="Houve Corretagem" value={corretor ? '( X ) sim ( ) não' : '( ) sim ( X ) não'} />
                    {corretor && (
                        <div className="pl-4 mt-2">
                            <p className="font-semibold text-base mb-2">7.1) Caso haja corretagem:</p>
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

                <QuadroSecaoTexto titulo="8) Cláusula Penal:" texto={[`Percentual: 10% sobre valor do Imóvel`]} />

                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">9) Rescisão Contratual:</h3>
                    <div className="pl-4">
                        <p className="font-semibold text-base mb-2">9.1) Por Mútuo Acordo Entre as Partes:</p>
                        <p className='text-sm text-gray-800'>Penalidade: Retenção de todo o valor líquido recebido pela Vendedora, inclusive a comissão de corretagem, sem aplicação da Cláusula Penal. Salvo acordo contrário entre as partes.</p>

                        <p className="font-semibold text-base mt-4 mb-2">9.2) Por inadimplemento de 3 parcelas (consecutivas ou não) ou por descumprimento das cláusulas contratuais que impeça o prosseguimento do negócio:</p>
                        <p className='text-sm text-gray-800'>Penalidades: Aplicação da Cláusula Penal mencionada no tópico anterior; Retenção pela Vendedora de 25% de todo o valor pago pelo(a) Comprador(a); Retenção da comissão de corretagem.</p>
                        <p className='text-sm text-gray-800 mt-2'>Em caso de já ter ocorrido a imissão na posse: Aplicação das penalidades mencionadas nesse tópico; Retomada da posse pela Vendedora; Pagamentos dos impostos incidentes sobre o imóvel até a data da retomada da posse; Pagamentos das taxas condominiais incidentes sobre o imóvel até a data da retomada da posse; Pagamento do percentual de 0,5% sobre o valor atualizado deste contrato, pro rata die, por ter usufruído do imóvel.</p>
                    </div>
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">10) Direito ao Arrependimento:</h3>
                    <p className='text-sm text-gray-800'>Será possível o desfazimento do contrato dentro de 7 dias contados da assinatura do presente instrumento, quando celebrado em estandes de vendas ou fora da sede do incorporador ou do estabelecimento comercial.</p>
                    <p className='text-sm text-gray-800 mt-2 font-semibold'>Da devolução dos valores: Ocorrendo o exercício do direito de arrependimento, todo o valor pago será devolvido, inclusive a comissão de corretagem.</p>
                    <QuadroLinha label="Prazo para devolução" value="15 dias, contados do aviso do arrependimento." />
                    <QuadroLinha label="Conta para eventual devolução" />
                </div>

                <div className="border border-gray-300 p-4 mb-4">
                    <h3 className="font-bold mb-2">11) Comunicação/Notificação entre as partes:</h3>
                    <div className="pl-4">
                        <p className="font-semibold text-base mb-2">11.1) Vendedora:</p>
                        <QuadroLinha label="Responsável" value="RANNIERE CAMPOS MENDES" />
                        <QuadroLinha label="Endereço" value="Avenida Rio Doce, nº 1825, Loja, Sala A, Ilha dos Araújos, Governador Valadares/MG, CEP 35.020-500" />
                        <QuadroLinha label="E-mail" value="contato@studio57.arq.br" />
                        <QuadroLinha label="Telefone/Whatsapp" value="+55 33 99943-4841" />

                        <p className="font-semibold text-base mt-4 mb-2">11.2) Comprador(a):</p>
                        <QuadroLinha label="Responsável" value={comprador?.nome || comprador?.razao_social} />
                        <QuadroLinha label="Endereço" value={formatarEndereco(comprador)} />
                        <QuadroLinha label="E-mail" value={comprador?.emails?.[0]?.email} />
                        <QuadroLinha label="Telefone/Whatsapp" value={comprador?.telefones?.[0]?.telefone} />
                    </div>
                </div>
                
                <div className="mt-8 pt-8 border-t-2 border-black" style={{ pageBreakBefore: 'always' }}>
                    <h2 className="text-center font-bold text-lg mb-6 uppercase">
                        PROMESSA PARTICULAR DE COMPRA E VENDA DE IMÓVEL URBANO
                    </h2>
                    <p className="text-sm text-justify mb-6">
                        As partes qualificadas no Quadro Resumo anexo a este Contrato firmam o presente na melhor forma do direito, regendo-se tal relação pelas cláusulas e condições aqui previstas e expressas de forma resumida no Quadro Resumo.
                    </p>

                    <Clausula titulo="DAS CONSIDERAÇÕES PRELIMINARES">
                        <p>I. A VENDEDORA é proprietária do imóvel descrito na Matrícula {empreendimento?.matricula_numero} do Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG, onde está sendo implantado por ela o edifício denominado “{empreendimento?.nome_empreendimento}”, de agora em diante denominado apenas como EMPREENDIMENTO;</p>
                        <p>II. O EMPREENDIMENTOserá formado, ao todo, por 1 (uma) loja comercial, 20 (vinte) apartamentos residenciais e 20 (vinte) garagens privativas autônomas, além das áreas comuns.</p>
                        <p>III. O memorial de incorporação do EMPREENDIMENTO, bem como a instituição de condomínio, encontra-se devidamente registrados na Matrícula-mãe {empreendimento?.matricula_numero} do Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG;</p>
                        <p>IV. Todas as unidades privativas, incluindo a(s) adquirida(s) pelo(a) COMPRADOR(A), terão matrículas autônomas, onde será(ão) registrada(s), em momento oportuno, a(s) transferência(s) da(s) propriedade(s) imobiliária(s) pela VENDEDORA;</p>
                        <p>V. A incorporação encontra-se submetida ao regime de preço global, motivo pelo qual a VENDEDORA está legalmente autorizada a realizar, ainda durante a execução das obras, a alienação das “unidades autônomas futuras” com preço reajustável;</p>
                        <p>VI. A construção do EMPREENDIMENTO será realizada pela construtora ARKOS CONSTRUÇÕES LTDA, inscrita no CNPJ sob o nº 47.180.830/0001-01;</p>
                        <p>VII. O patrimônio de afetação da incorporação do EMPREENDIMENTO está em processo de averbação perante o Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG;</p>
                        <p>VIII. Ao(À) COMPRADOR(A)foi oportunizado o acesso à Convenção de Condomínio do EMPREENDIMENTO, aos quais se obrigam o(a) COMPRADOR(A), além dos seus inquilinos, ocupantes e possuidores a qualquer título das unidades autônomas e empregados, prestadores de serviços, visitantes e demais pessoas que estejam ligadas, de modo permanente ou transitório, às áreas comuns ou às unidades autônomas do edifício.</p>
                        <p>IX. É parte integrante do presente contrato os seguintes documentos: (i) Vista Isométrica do IMÓVEL; (ii) Memorial Descritivo do IMÓVEL; (iii) Planilha com Resumo de Pagamentos.</p>
                    </Clausula>

                    <Clausula titulo="DAS CLÁUSULAS E CONDIÇÕES" subtitulo="DO OBJETO">
                        <p><strong>CLÁUSULA 1º.</strong> Constitui objeto do presente contrato a transferência da propriedade da(s) unidade(s) descrita(s) no Quadro Resumo anexo, de forma irrevogável, irretratável e onerosa, mediante o cumprimento das obrigações previstas neste instrumento contratual e no Quadro Resumo.</p>
                        <p><strong>§ 1º.</strong> O(A) COMPRADOR(A)tem ciência de que, apesar de o EMPREENDIMENTO encontrar-se documentalmente regular, este ainda passará pela fase de obras, conforme exigência legal, cabendo à VENDEDORA ou à construtora contratada por ela a obrigação de realizar a construção da edificação.</p>
                        <p><strong>§ 2º.</strong> A efetiva transferência da propriedade da(a) unidade(s) adquirida(s) pelo(a) COMPRADOR(A)ocorrerá por meio de outorga de Escritura Pública de Compra e Venda ou documento análogo pela VENDEDORA, sendo que tal outorga somente acontecerá após o pagamento de todo o valor pelo(a) COMPRADOR(A).</p>
                        <p><strong>§ 3º.</strong> A escolha do Cartório de Notas que outorgará a competente Escritura Pública de Compra e Venda, caberá à VENDEDORA.</p>
                        <p><strong>§ 4º.</strong> Caberá ao(à) COMPRADOR(A)arcar com todas as despesas e emolumentos decorrentes da outorga e registro da Escritura Pública de Compra e Venda ou documento análogo, tais como impostos (ITBI) e emolumentos cartorários.</p>
                        <p><strong>§ 5º.</strong> A presente compra e venda ocorre na modalidade Ad Corpus, tendo sido oportunizado ao(à) COMPRADOR(A) acesso aos projetos da(s) unidade(s) descrita(s) no Quadro Resumo.</p>
                        <p><strong>§ 6º.</strong> O(A) COMPRADOR(A) tem ciência de que as informações constantes no memorial de incorporação, bem como no memorial de vendas, prevalecem sobre as divulgadas nos materiais de marketing, de forma que as tonalidades das cores, as formas e as texturas nas imagens divulgadas nos materiais de marketing são meramente ilustrativas e podem sofrer alterações durante as compatibilizações técnicas, além das vegetações representarem artisticamente a fase adulta das espécies.</p>
                        <p><strong>§ 7º.</strong> A VENDEDORA se reserva o direito de troca de materiais e marcas, caso não estejam disponíveis no mercado por material equivalente de padrão e qualidade.</p>
                    </Clausula>

                    <Clausula subtitulo="DO VALOR, DA FORMA DE PAGAMENTO E DO REAJUSTE">
                        <p><strong>CLÁUSULA 2º.</strong> Como contrapartida pela transferência da propriedade da(s) unidade(s) adquirida(s), o(a) COMPRADOR(A), caso opte pelo pagamento à vista (item 3.1), pagará à VENDEDORA, o valor previsto no tópico 3 de Quadro Resumo, conforme especificado no mesmo Quadro, sendo necessário a VENDEDORA emitir recibo de quitação para o(a) COMPRADOR(A).</p>
                        <p><strong>CLÁUSULA 3º.</strong> Caso o(a) COMPRADOR(A)opte pelo pagamento com recursos próprios e de forma parcelada (item 3.2), deverá pagar à VENDEDORA o valor previsto no tópico 3 do Quadro Resumo, da seguinte maneira:</p>
                        <p>I. A entrada/sinal prevista no Quadro Resumo, devendo o valor ser quitado de forma integral e à vista no prazo também previsto no Quadro Resumo, sendo tal entrada considerada o início do negócio e princípio de pagamento;</p>
                        <p>II. Os demais valores, abatida a entrada/sinal, serão divididos na quantidade de parcelas previstas no Quadro Resumo, onde também está estipulada a data de vencimento de cada uma delas.</p>
                        <p><strong>§ 1º.</strong> Optando o(a) COMPRADOR(A)pelo pagamento parcelado, este também deverá observar o exposto no Quadro Resumo, não sendo necessário, entretanto, a VENDEDORA emitir recibo de quitação mensal, sendo suficiente, como meio de prova de quitação, o recibo bancário ou documento análogo, sendo necessária, entretanto, a emissão de recibo de quitação pela VENDEDORA após a realização do pagamento total.</p>
                        <p><strong>§ 2º.</strong> Em caso de o(a) COMPRADOR(A)optar pelo pagamento parcelado e se, por qualquer motivo, o valor mencionado no inciso I desta Cláusula não for pago dentro do prazo previsto no Quadro Resumo, o presente instrumento estará rescindido de pleno direito, sendo desnecessária qualquer notificação, ciência ou intimação do(a) COMPRADOR(A) para tal fim, podendo a VENDEDORA alienar para terceiros a(s) unidade(s) objeto deste Contrato.</p>
                        <p><strong>§ 3º.</strong> Caso o pagamento venha a acontecer por meio de cheque, a dívida somente estará quitada após a devida compensação bancária deste. Da mesma forma, ocorrendo o pagamento por meio de transferências bancárias e/ou chave PIX, o valor só será considerado pago após a comprovação do crédito do valor na conta bancária prevista no Quadro Resumo.</p>
                        <p><strong>CLÁUSULA 4º.</strong> Fica acordado entre as partes que as parcelas assumidas pelo(a) COMPRADOR(A) serão trimestralmente reajustadas na mesma data de celebração deste Contrato, por meio do Índice Nacional de Custo da Construção (INCC), no período correspondente, respeitando o limite mínimo de 5% (cinco por cento) e máximo de 10% (dez por cento).</p>
                        <p><strong>PARÁGRAFO ÚNICO.</strong> Não será adotado, sob nenhum contexto, a utilização de índices variáveis para reajuste das parcelas assumidas pelo(a) COMPRADOR(A).</p>
                        <p><strong>CLÁUSULA 5º.</strong> Sendo realizado o pagamento por meio de financiamento bancário (item 3.3), fica estipulado o seguinte:</p>
                        <p>I. O(A) COMPRADOR(A) poderá efetuar parte do pagamento com recursos próprios e parte por meio de financiamento bancário, sendo que, optando por parte do pagamento com recursos próprios, deverá observar todo o exposto no item 3.3.1 doQuadro Resumo.</p>
                        <p>II. A porção do pagamento que será realizado mediante financiamento, deverá ser paga à vista pela Instituição Financiadora, conforme previsão do item 3.3.2 do Quadro Resumo.</p>
                        <p><strong>§ 1º.</strong> Tendo o(a) COMPRADOR(A) optado pelo financiamento bancário para adimplemento da parcela prevista no inciso II desta Cláusula, deverá o(a) mesmo(a) buscar e obter, sob sua responsabilidade, crédito perante Agente Financeiro, devendo firmar o contrato de financiamento com a Instituição Financeira.</p>
                        <p><strong>§ 2º.</strong> Na hipótese de que seja o(a) COMPRADOR(A) obrigado(a) a contrair financiamento de valor menor, deverá este(a) acrescentar a diferença do valor no montante previsto no item 3.3.1 do Quadro Resumo.</p>
                        <p><strong>§ 3º.</strong> Todas as despesas inerentes à obtenção do financiamento, sejam elas de que natureza forem, tais como impostos, taxas bancárias, despesas com emolumentos/certidões, tabelionatos, registro de imóveis, honorários de despachantes, avaliações, etc., bem como todos os encargos e custos financeiros decorrentes do mútuo, tais como os juros incidentes sobre o valor financiado, correrão por conta e responsabilidade do(a) COMPRADOR(A).</p>
                        <p><strong>§ 4º.</strong> Consoante versado anteriormente, o financiamento será postulado pelo(a) COMPRADOR(A) por sua iniciativa e risco, e somente lhe será concedido caso por ele(a) sejam satisfeitas as exigências cadastrais e documentais, as quais o(a) mesmo(a) declara conhecer e se obriga prontamente a satisfazê-las; de modo que a VENDEDORA não tem qualquer responsabilidade quanto aos dados fornecidos pelo(a) COMPRADOR(A) e tampouco se responsabiliza, principalmente, pela aprovação do crédito junto à Instituição Financeira.</p>
                        <p><strong>§ 5º.</strong> Fica perfeitamente claro e convencionado que na eventualidade do(a) COMPRADOR(A) não vir a ter êxito na obtenção do financiamento, caberá à VENDEDORA decidir pelo prosseguimento do negócio ou não, podendo para tanto realizar diligências para verificar a saúde financeira do(a) COMPRADOR(A).</p>
                        <p><strong>§ 6º.</strong> Decidindo a VENDEDORA pelo prosseguimento do negócio, mesmo após ter sido negada a aprovação do financiamento para o(a) COMPRADOR(A), este deverá pagar com recursos próprios para à VENDEDORA, observando as disposições do item 3.2 do Quadro Resumo.</p>
                    </Clausula>

                    <Clausula subtitulo="DO INADIMPLEMENTO">
                        <p><strong>CLÁUSULA 6º.</strong> Não sendo pagas as parcelas mencionadas no Quadro Resumo na data prevista, estas ficarão sujeitas, até o seu respectivo pagamento, à correção monetária pelo índice previsto anteriormente, acrescidas de juros de mora de 1% (um por cento), mais multa no importe de 2% (dois por cento) sobre o valor vencido e não pago.</p>
                        <p><strong>§ 1º.</strong> As sanções aqui previstas serão aplicadas automaticamente em caso de inadimplência de qualquer uma das parcelas, não sendo necessária a ocorrência de notificação ou interpelação, judicial ou extrajudicial.</p>
                        <p><strong>§ 2º.</strong> Fica assegurado ao(à) COMPRADOR(A) o prazo de 15 (quinze) dias corridos, contados do dia posterior ao vencimento da parcela, para purgar a mora.</p>
                        <p><strong>CLÁUSULA 7º.</strong> A aplicação da penalidade aqui expressa não impede o exercício do direito de retomada da posse pela VENDEDORA em razão do inadimplemento de 3 (três) parcelas, consecutivas ou não, nos termos da Cláusula 13ª deste contrato, bem como a rescisão contratual também prevista neste contrato na Cláusula 22ª.</p>
                        <p><strong>PARÁGRAFO ÚNICO.</strong> Na situação prevista no caput deste artigo, o(a) COMPRADOR(A) será notificado pela VENDEDORA para purgar a mora dentro do prazo de 10 (dez) dias, contados do recebimento da notificação. Não sendo efetuado o pagamento, serão aplicadas as penalidades previstas nesta Cláusula.</p>
                    </Clausula>

                    <Clausula subtitulo="DA COMISSÃO DE CORRETAGEM">
                        <p><strong>CLÁUSULA 8º.</strong> Em razão da intermediação do negócio aqui firmado, fica estabelecido o pagamento da comissão de corretagem pelo(a) COMPRADOR(A), conforme dados previstos no Quadro Resumo.</p>
                        <p><strong>§ 1º.</strong> O(A) COMPRADOR(A) declara expressamente a sua ciência sobre o não englobamento da comissão de corretagem ao preço da(s) unidade(s) imobiliária(s) objeto deste contrato, tratando-se de valores distintos e independentes entre si.</p>
                        <p><strong>§ 2º.</strong> Em caso de inadimplência do(a) COMPRADOR(A) no que diz respeito ao pagamento da comissão aqui prevista, a VENDEDORA não se responsabiliza pelo pagamento, cabendo ao corretor tomar as devidas providências judiciais e extrajudiciais que entender serem necessárias.</p>
                    </Clausula>

                    <Clausula subtitulo="DO PRAZO E DA EXECUÇÃO DAS OBRAS">
                        <p><strong>CLÁUSULA 9º.</strong> A conclusão das obras da(s) unidade(s) imobiliária(s) deverá acontecer dentro do prazo previsto no Quadro Resumo.</p>
                        <p><strong>PARÁGRAFO ÚNICO.</strong> Fica estipulada que eventual alteração no prazo do cronograma físico-financeiro, também vinculará a data da entrega do EMPREENDIMENTO.</p>
                        <p><strong>CLÁUSULA 10º.</strong> Não ocorrendo a conclusão da obra dentro do prazo previsto na Quadro Resumo, fica garantido à VENDEDORA a tolerância de até 180 (cento e oitenta) dias corridos além prazo previsto, salvo motivos de caso fortuito ou força maior, não havendo necessidade de concordância do(a) COMPRADOR(A) para tanto.</p>
                        <p><strong>PARÁGRAFO ÚNICO.</strong> Serão consideradas situações de caso fortuito e força maior, greves, falta de materiais no mercado ou de mão de obra qualificada, chuvas prolongadas, demoras atreladas a órgãos de serviços públicos para conseguir autorizações e licenças necessárias para a execução da obra que não dependam da VENDEDORA, demora na concessão de habite-se por fato não atribuível à VENDEDORA, pandemias, demandas judiciais que envolvam o terreno e que impeçam o uso natural do IMÓVEL, demora atrelada à Junta Comercial de Minas Gerais e que não seja atribuível à VENDEDORA, eventual embargo da obra, dentre outras situações sobre as quais a VENDEDORAnão possui meios para controlar e que possam direta ou indiretamente prejudicar ou impedir o cumprimento integral da obrigação assumida.</p>
                        <p><strong>CLÁUSULA 11º.</strong> A VENDEDORA se compromete a seguir as diretrizes dos projetos arquitetônicos aprovados pelos órgãos municipais.</p>
                        <p><strong>§ 1º.</strong> Poderá a VENDEDORA, em razão de conveniência técnica ou por determinação do poder público, promover modificações no projeto aprovado, independentemente de realização de consulta ao(à) COMPRADOR(A).</p>
                        <p><strong>§ 2º.</strong> Na situação prevista no parágrafo anterior, não caberá ao(à) COMPRADOR(A) direito a indenização ou qualquer tipo de compensação.</p>
                    </Clausula>

                    <Clausula subtitulo="DA IMISSÃO NA POSSE">
                        <p><strong>CLÁUSULA 12º.</strong> Fica acordado entre as partes que o(a) COMPRADOR(A) será imitido(a) na posse da(s) unidade(s) adquirida(s) por ele(a) somente após a finalização das obras e com a emissão do habite-se pelo município.</p>
                        <p><strong>§ 1º.</strong> A imissão na posse pelo(a) COMPRADOR(A) apenas acontecerá se este estiver com o pagamento em dia de todas as parcelas assumidas, bem como com as demais obrigações consentidas ao longo deste contrato.</p>
                        <p><strong>§ 2º.</strong> Uma vez que o(a) COMPRADOR(A)fique imitido(a) na posse, a VENDEDORA estará eximida da responsabilidade pelo pagamento de tributos e despesas inerentes ao IMÓVEL, tais como IPTU, taxa de lixo, taxa de condomínio, contas de águas e luz, dentre outras, passando estas a serem de responsabilidade exclusiva do(a) COMPRADOR(A).</p>
                        <p><strong>CLÁUSULA 13º.</strong> Caso o(a) COMPRADOR(A) se torne inadimplente em razão do descumprimento dos pagamentos das parcelas e já tendo sido imitido(a) na posse, a VENDEDORA poderá se valer do direito de retomada da posse da(s) unidade(s) descrita(s) no Quadro Resumo, não tendo o(a) COMPRADOR(A)direito a retenção ou indenização de possíveis benfeitorias, valendo este instrumento como título executivo de obrigação de fazer (restituir o bem).</p>
                    </Clausula>

                    <Clausula subtitulo="DOS DIREITOS E OBRIGAÇÕES DAS PARTES">
                        <p><strong>CLÁUSULA 14º.</strong> São obrigações da VENDEDORA:</p>
                        <p>I. Realizar a construção das obras do EMPREENDIMENTO, conforme projeto aprovado pelo município;</p>
                        <p>II. Empenhar os melhores esforços para finalização da obra dentro do prazo previsto no Quadro Resumo;</p>
                        <p>III. Entregar a posse da(s) unidade(s) descrita(s) no Quadro Resumo para o(a) COMPRADOR(A),nos termos da Cláusula 12ª deste Contrato, sem oposição nem embaraços.</p>
                        <p><strong>CLÁUSULA 15º.</strong> São obrigações do(a) COMPRADOR(A):</p>
                        <p>I. Realizar os pagamentos da forma e nas datas previstas no Quadro Resumo;</p>
                        <p>II. Realizar o pagamento da comissão de corretagem conforme especificado no Quadro Resumo;</p>
                        <p>III. Arcar com todas as despesas para outorga da Escritura Pública de Compra e Venda;</p>
                        <p>IV. Assumir, após a imissão na posse, todas as despesas inerentes à(a) unidade(s) descrita(s) no Quadro Resumo, tais como contas de energia, água, IPTU, taxa condominial etc.;</p>
                        <p>V. Respeitar todos os termos da Convenção de Condomínio e do Regimento Interno, quando aprovado;</p>
                        <p>VI. Em caso de resolução contratual em razão de inadimplemento, entregar a posse da(s) unidade(s) descrita(s) no Quadro Resumo sem que haja a necessidade de interpelação judicial para tanto.</p>
                        <p><strong>CLÁUSULA 16º.</strong> O(A) COMPRADOR(A) não poderá interferir, direta ou indiretamente, no andamento normal das obras do EMPREENDIMENTO, nem solicitar modificações nos projetos durante a execução das obras.</p>
                        <p><strong>PARÁGRAFO ÚNICO.</strong> Uma vez imitido na posse, o(a) COMPRADOR(A) deverá submeter qualquer projeto de reformas, reparos, instalações ou retiradas em geral nas áreas privativas ao síndico ou, na sua falta, ao subsíndico ou à administradora.</p>
                        <p><strong>CLÁUSULA 17º.</strong> Poderá o(a) COMPRADOR(A) realizar visitação na(s) unidade(s) adquirida(s) por ele(a), desde que previamente agendada junto à VENDEDORA, cabendo a estas julgarem aspectos de conveniência e relevância quanto à visitação, conforme suas disponibilidades, não se obrigando, entretanto, à realização de tal agendamento.</p>
                        <p><strong>CLÁUSULA 18º.</strong> Fica expressamente proibida a cessão ou transferência de direitos deste Contrato pelo(a) COMPRADOR(A) a terceiros, sem a anuência da VENDEDORA, sendo considerada inválida tal transferência e não desobrigando o(a) COMPRADOR(A) de todas a obrigações aqui assumidas.</p>
                        <p><strong>CLÁUSULA 19º.</strong> Fica expressamente proibida a alienação de garagens privativas autônomas, que compõe o EMPREENDIMENTO, para terceiros.</p>
                        <p><strong>CLÁUSULA 20º.</strong> Caberá ao(a) COMPRADOR(A), quando se tratar de casos de alienação, locação (inclusive de curto prazo), cessão, comodato e outros que importem na transferência de direitos relativos ao condomínio ou das unidades autônomas, cientificar a terceiros acerca da Convenção de Condomínio e do Regimento Interno, obrigando-os a respeitar todas as disposições contidas nestes instrumentos.</p>
                    </Clausula>

                    <Clausula subtitulo="DA CLÁUSULA PENAL">
                        <p><strong>CLÁUSULA 21º.</strong> O descumprimento das cláusulas previstas neste Contrato acarretará a aplicação da Cláusula Penal no importe de 10% (dez por cento) sobre o valor total especificado no Quadro Resumo, sendo a multa será suportada pela parte que der causa à inexecução contratual.</p>
                        <p><strong>PARÁGRAFO ÚNICO.</strong> O descumprimento das obrigações assumidas pelo(a) COMPRADOR(A) não impede que a parte que descumpriu as obrigações impostas neste contrato seja demandada judicialmente pela parte prejudicada.</p>
                    </Clausula>

                    <Clausula subtitulo="DA RESCISÃO CONTRATUAL">
                        <p><strong>CLÁUSULA 22º.</strong> O presente Contrato ficará rescindido nas seguintes situações:</p>
                        <p>I. Por mútuo acordo entre as partes;</p>
                        <p>II. Em razão de inadimplemento de 3 (três) parcelas, consecutivas ou não;</p>
                        <p>III. Descumprimento de cláusulas deste Contrato pelo(a) COMPRADOR(A) que impeça seu prosseguimento.</p>
                        <p><strong>§ 1º.</strong> Na hipótese prevista no inciso I desta Cláusula, ocorrerá a rescisão contratual sem a incidência da Cláusula Penal, devendo a VENDEDORA permanecer com o valor líquido que recebeu, salvo se as partes acordarem diversamente.</p>
                        <p><strong>§ 2º.</strong> Na hipótese dos incisos II e III, ocorrerá a rescisão contratual com a aplicação da Cláusula Penal sobre o valor total previsto no Quadro Resumo, além da ocorrência do exercício da retomada da posse, caso o(a) COMPRADOR(A) já esteja imitido(a) nela.</p>
                        <p><strong>§ 3º.</strong> Ocorrendo a rescisão em razão do exposto nos incisos II e III, além da aplicação da multa expressa no parágrafo anterior, ficará retido 25% (vinte e cinco por cento) de todo o valor que tenha sido pago pelo(a) VENDEDOR(A).</p>
                        <p><strong>§ 4º.</strong> Em todas as situações expostas nos incisos dessa Cláusula, ocorrerá a retenção do valor pago a título de comissão de corretagem pelo(a) COMPRADOR(A).</p>
                        <p><strong>§ 5º.</strong> Na hipótese do(a) COMPRADOR(A) já ter sido imitido(a) na posse da(s) unidade(s) descrita(s) no Quadro Resumo, além do previsto nos parágrafos anteriores, este(a) responderá ainda pelos impostos incidentes sobre aqueles bens imóveis, pelas contribuições condominiais, além do percentual de 0,5% sobre o valor atualizado deste contrato, pro rata die, por ter usufruído deles.</p>
                        <p><strong>§ 6º.</strong> A VENDEDORA independentemente do motivo da rescisão deste Contrato, poderá revender a(s) unidade(s) adquirida(s) pelo(a) COMPRADOR(A) a outrem.</p>
                    </Clausula>

                    <Clausula subtitulo="DO DIREITO AO ARREPENDIMENTO">
                        <p><strong>CLÁUSULA 23º.</strong> O(A) COMPRADOR(A) poderá exercer o seu direito ao arrependimento dentro do prazo improrrogável de 7 (sete) dias, contados da assinatura do presente instrumento contratual, caso o presente negócio tenha acontecido em estandes de vendas ou fora da sede da VENDEDORA.</p>
                        <p><strong>§ 1º.</strong> Nessa situação, será devolvido pela VENDEDORA para o(a) COMPRADOR(A), todo o valor que tenha sido efetivamente pago, inclusive a comissão de corretagem, dentro do prazo previsto no quadro resumo.</p>
                        <p><strong>§ 2º.</strong> O valor deverá ser devolvido para a conta bancária prevista no quadro resumo.</p>
                    </Clausula>

                    <Clausula subtitulo="DA COMUNICAÇÃO ENTRE AS PARTES">
                        <p><strong>CLÁUSULA 24º.</strong> Qualquer notificação ou comunicação exigida ou permitida de acordo com o presente Contrato deverá ser realizada por escrito e será considerada como entregue: (i) pessoalmente à parte mediante protocolo, ou (ii) se enviada por mensageiro, e-mail com confirmação de recebimento e/ou correspondência com aviso de recebimento, para os e-mails, telefones e endereços previstos no Quadro Resumo.</p>
                    </Clausula>

                    <Clausula subtitulo="DAS DISPOSIÇÕES PROCESSUAIS E FINAIS">
                        <p><strong>CLÁUSULA 25º. Execução:</strong> Conforme o disposto no artigo 784, III, do Código de Processo Civil, este instrumento constitui título executivo extrajudicial, idôneo para com ele, qualquer das partes compelir a outra ao cumprimento forçado da obrigação.</p>
                        <p><strong>CLÁUSULA 26º. Comunicação:</strong> Fica acordado, ainda, que, para todas as razões de Direito, terá validade, como meio alternativo de comunicação, a citação/notificação/interpelação via e-mail, mensagem e endereços fornecidos no capítulo próprio, ficando a parte que alterar seu endereço com a obrigação de comunicar tal fato a outra parte, sob pena de se considerar citado/notificado/intimado pelo simples recebimento de comunicado em algum dos meios/endereços informados no preâmbulo.</p>
                        <p><strong>CLÁUSULA 27º. Negócio jurídico processual:</strong> Ante o permissivo contido no artigo 190 do Código de Processo Civil, as partes pactuam procedimento próprio para demandas eventualmente oriundas do presente contrato, ficando os referidos e eventuais processos sujeitos às seguintes disposições:</p>
                        <p>I. Os contratantes elegem este contrato como prova absoluta da plausibilidade dos direitos nele tratados ou dele decorrentes, para fins de concessão da tutela provisória da evidência, referida no artigo 311 do Código de Processo Civil;</p>
                        <p>II. Renunciam os contratantes ao direito de discutir a validade, legalidade, eficácia, veracidade, autonomia da vontade ou onerosidade no tocante às cláusulas e disposições deste instrumento;</p>
                        <p>III. Pactuam a validade da prova produzida extrajudicialmente, desde que produzida no foro deste contrato e com respeito ao contraditório, considerando-se respeitado se o contratante, validamente notificado com antecedência mínima de 15 (quinze) dias úteis para participar do ato de produção da prova ou informar impossibilidade de comparecimento, não comparecer ou se fizer representar no ato de produção da prova;</p>
                        <p><strong>CLÁUSULA 28º. Tolerância:</strong> Fica pactuado que o aditamento deste contrato far-se-á exclusivamente pela via escrita, por meio de aditivo assinado pelas partes e coobrigados, sendo sem efeito o aditivo verbal ou tácito, não havendo, assim, aquisição de direito por liberalidade da outra parte ou inércia no exercício de prerrogativa contratual.</p>
                        <p><strong>CLÁUSULA 29º. Foro:</strong> As partes elegem o foro da comarca de Governador Valadares/MG, quaisquer que sejam seus domicílios, para dirimir todas as controvérsias porventura imanentes deste pacto, com expressa renúncia a qualquer outro foro, por mais especial que seja.</p>
                    </Clausula>

                    <p className="text-sm text-justify my-6">E por ser firme e justo, da livre e desembaraçada vontade das partes contratantes, é que assinam o presente em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.</p>

                </div>


                {/* --- Seção de Assinaturas --- */}
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