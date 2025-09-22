// components/contratos/ClausulasContrato.js
"use client";

import React from 'react';

// A MUDANÇA ESTÁ AQUI: Removi a classe 'break-after-page' que causava os espaços em branco.
const Clausula = ({ titulo, children }) => (
    <div className="mb-4">
        <p className="font-bold text-sm mb-2 uppercase">{titulo}</p>
        <div className="text-sm text-justify space-y-3">
            {children}
        </div>
    </div>
);

const Paragrafo = ({ children, className = '' }) => <p className={className}>{children}</p>;

const TituloSecao = ({ children }) => <h3 className="text-center font-bold text-sm my-4 uppercase">{children}</h3>;

const ItemLista = ({ numero, children }) => (
    <div className="flex">
        <span className="w-12 text-left">{numero}</span>
        <div className="flex-1">{children}</div>
    </div>
);


export default function ClausulasContrato() {
    return (
        <>
            <p className="text-sm text-justify mb-6">
                As partes qualificadas no Quadro Resumo anexo a este Contrato firmam o presente na melhor forma do direito, regendo-se tal relação pelas cláusulas e condições aqui previstas e expressas de forma resumida no Quadro Resumo.
            </p>
            
            <TituloSecao>DAS CONSIDERAÇÕES PRELIMINARES</TituloSecao>

            <div className="space-y-2 text-sm text-justify">
                <ItemLista numero="I.">
                    A VENDEDORA é proprietária do imóvel descrito na Matrícula 24.920 do Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG, onde está sendo implantado por ela o edifício denominado “Condomínio Residencial Alfa”, de agora em diante denominado apenas como EMPREENDIMENTO;
                </ItemLista>
                <ItemLista numero="II.">
                    O EMPREENDIMENTO será formado, ao todo, por 1 (uma) loja comercial, 20 (vinte) apartamentos residenciais e 20 (vinte) garagens privativas autônomas, além das áreas comuns.
                </ItemLista>
                <ItemLista numero="III.">
                    O memorial de incorporação do EMPREENDIMENTO, bem como a instituição de condomínio, encontra-se devidamente registrados na Matrícula-mãe 24.920 do Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG;
                </ItemLista>
                <ItemLista numero="IV.">
                    Todas as unidades privativas, incluindo a(s) adquirida(s) pelo(a) COMPRADOR(A), terão matrículas autônomas, onde será(ão) registrada(s), em momento oportuno, a(s) transferência(s) da(s) propriedade(s) imobiliária(s) pela VENDEDORA;
                </ItemLista>
                <ItemLista numero="V.">
                    A incorporação encontra-se submetida ao regime de preço global, motivo pelo qual a VENDEDORA está legalmente autorizada a realizar, ainda durante a execução das obras, a alienação das “unidades autônomas futuras” com preço reajustável;
                </ItemLista>
                <ItemLista numero="VI.">
                    A construção do EMPREENDIMENTO será realizada pela construtora ARKOS CONSTRUÇÕES LTDA, inscrita no CNPJ sob o nº 47.180.830/0001-01;
                </ItemLista>
                <ItemLista numero="VII.">
                    O patrimônio de afetação da incorporação do EMPREENDIMENTO está em processo de averbação perante o Segundo Ofício de Registro de Imóveis da Comarca de Governador Valadares/MG;
                </ItemLista>
                <ItemLista numero="VIII.">
                    Ao(À) COMPRADOR(A) foi oportunizado o acesso à Convenção de Condomínio do EMPREENDIMENTO, aos quais se obrigam o(a) COMPRADOR(A), além dos seus inquilinos, ocupantes e possuidores a qualquer título das unidades autônomas e empregados, prestadores de serviços, visitantes e demais pessoas que estejam ligadas, de modo permanente ou transitório, às áreas comuns ou às unidades autônomas do edifício.
                </ItemLista>
                <ItemLista numero="IX.">
                    É parte integrante do presente contrato os seguintes documentos: (i) Vista Isométrica do IMÓVEL; (ii) Memorial Descritivo do IMÓVEL; (iii) Planilha com Resumo de Pagamentos.
                </ItemLista>
            </div>

            <TituloSecao>DAS CLÁUSULAS E CONDIÇÕES</TituloSecao>

            <Clausula titulo="DO OBJETO">
                <Paragrafo><strong>CLÁUSULA 1º.</strong> Constitui objeto do presente contrato a transferência da propriedade da(s) unidade(s) descrita(s) no Quadro Resumo anexo, de forma irrevogável, irretratável e onerosa, mediante o cumprimento das obrigações previstas neste instrumento contratual e no Quadro Resumo.</Paragrafo>
                <Paragrafo><strong>§ 1º.</strong> O(A) COMPRADOR(A) tem ciência de que, apesar de o EMPREENDIMENTO encontrar-se documentalmente regular, este ainda passará pela fase de obras, conforme exigência legal, cabendo à VENDEDORA ou à construtora contratada por ela a obrigação de realizar a construção da edificação.</Paragrafo>
                <Paragrafo><strong>§ 2º.</strong> A efetiva transferência da propriedade da(a) unidade(s) adquirida(s) pelo(a) COMPRADOR(A) ocorrerá por meio de outorga de Escritura Pública de Compra e Venda ou documento análogo pela VENDEDORA, sendo que tal outorga somente acontecerá após o pagamento de todo o valor pelo(a) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>§ 3º.</strong> A escolha do Cartório de Notas que outorgará a competente Escritura Pública de Compra e Venda, caberá à VENDEDORA.</Paragrafo>
                <Paragrafo><strong>§ 4º.</strong> Caberá ao(à) COMPRADOR(A) arcar com todas as despesas e emolumentos decorrentes da outorga e registro da Escritura Pública de Compra e Venda ou documento análogo, tais como impostos (ITBI) e emolumentos cartorários.</Paragrafo>
                <Paragrafo><strong>§ 5º.</strong> A presente compra e venda ocorre na modalidade Ad Corpus, tendo sido oportunizado ao(à) COMPRADOR(A) acesso aos projetos da(s) unidade(s) descrita(s) no Quadro Resumo.</Paragrafo>
                <Paragrafo><strong>§ 6º.</strong> O(A) COMPRADOR(A) tem ciência de que as informações constantes no memorial de incorporação, bem como no memorial de vendas, prevalecem sobre as divulgadas nos materiais de marketing, de forma que as tonalidades das cores, as formas e as texturas nas imagens divulgadas nos materiais de marketing são meramente ilustrativas e podem sofrer alterações durante as compatibilizações técnicas, além das vegetações representarem artisticamente a fase adulta das espécies.</Paragrafo>
                <Paragrafo><strong>§ 7º.</strong> A VENDEDORA se reserva o direito de troca de materiais e marcas, caso não estejam disponíveis no mercado por material equivalente de padrão e qualidade.</Paragrafo>
            </Clausula>

            <Clausula titulo="DO VALOR, DA FORMA DE PAGAMENTO E DO REAJUSTE">
                <Paragrafo><strong>CLÁUSULA 2º.</strong> Como contrapartida pela transferência da propriedade da(s) unidade(s) adquirida(s), o(a) COMPRADOR(A), caso opte pelo pagamento à vista (item 3.1), pagará à VENDEDORA, o valor previsto no tópico 3 de Quadro Resumo, conforme especificado no mesmo Quadro, sendo necessário a VENDEDORA emitir recibo de quitação para o(a) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 3º.</strong> Caso o(a) COMPRADOR(A) opte pelo pagamento com recursos próprios e de forma parcelada (item 3.2), deverá pagar à VENDEDORA o valor previsto no tópico 3 do Quadro Resumo, da seguinte maneira:</Paragrafo>
                <ItemLista numero="I.">A entrada/sinal prevista no Quadro Resumo, devendo o valor ser quitado de forma integral e à vista no prazo também previsto no Quadro Resumo, sendo tal entrada considerada o início do negócio e princípio de pagamento;</ItemLista>
                <ItemLista numero="II.">Os demais valores, abatida a entrada/sinal, serão divididos na quantidade de parcelas previstas no Quadro Resumo, onde também está estipulada a data de vencimento de cada uma delas.</ItemLista>
                <Paragrafo><strong>§1º.</strong> Optando o(a) COMPRADOR(A) pelo pagamento parcelado, este também deverá observar o exposto no Quadro Resumo, não sendo necessário, entretanto, a VENDEDORA emitir recibo de quitação mensal, sendo suficiente, como meio de prova de quitação, o recibo bancário ou documento análogo, sendo necessária, entretanto, a emissão de recibo de quitação pela VENDEDORA após a realização do pagamento total.</Paragrafo>
                <Paragrafo><strong>§2º.</strong> Em caso de o(a) COMPRADOR(A) optar pelo pagamento parcelado e se, por qualquer motivo, o valor mencionado no inciso I desta Cláusula não for pago dentro do prazo previsto no Quadro Resumo, o presente instrumento estará rescindido de pleno direito, sendo desnecessária qualquer notificação, ciência ou intimação do(a) COMPRADOR(A) para tal fim, podendo a VENDEDORA alienar para terceiros a(s) unidade(s) objeto deste Contrato.</Paragrafo>
                <Paragrafo><strong>§3º.</strong> Caso o pagamento venha a acontecer por meio de cheque, a dívida somente estará quitada após a devida compensação bancária deste. Da mesma forma, ocorrendo o pagamento por meio de transferências bancárias e/ou chave PIX, o valor só será considerado pago após a comprovação do crédito do valor na conta bancária prevista no Quadro Resumo.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 4º.</strong> Fica acordado entre as partes que as parcelas assumidas pelo(a) COMPRADOR(A) serão trimestralmente reajustadas na mesma data de celebração deste Contrato, por meio do Índice Nacional de Custo da Construção (INCC), no período correspondente, respeitando o limite mínimo de 5% (cinco por cento) e máximo de 10% (dez por cento).</Paragrafo>
                <Paragrafo><strong>PARÁGRAFO ÚNICO.</strong> Não será adotado, sob nenhum contexto, a utilização de índices variáveis para reajuste das parcelas assumidas pelo(a) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 5º.</strong> Sendo realizado o pagamento por meio de financiamento bancário (item 3.3), fica estipulado o seguinte:</Paragrafo>
                <ItemLista numero="I.">O(A) COMPRADOR(A) poderá efetuar parte do pagamento com recursos próprios e parte por meio de financiamento bancário, sendo que, optando por parte do pagamento com recursos próprios, deverá observar todo o exposto no item 3.3.1 do Quadro Resumo.</ItemLista>
                <ItemLista numero="II.">A porção do pagamento que será realizado mediante financiamento, deverá ser paga à vista pela Instituição Financiadora, conforme previsão do item 3.3.2 do Quadro Resumo.</ItemLista>
                <Paragrafo><strong>§1º</strong> Tendo o(a) COMPRADOR(A) optado pelo financiamento bancário para adimplemento da parcela prevista no inciso II desta Cláusula, deverá o(a) mesmo(a) buscar e obter, sob sua responsabilidade, crédito perante Agente Financeiro, devendo firmar o contrato de financiamento com a Instituição Financeira.</Paragrafo>
                <Paragrafo><strong>§2º</strong> Na hipótese de que seja o(a) COMPRADOR(A) obrigado(a) a contrair financiamento de valor menor, deverá este(a) acrescentar a diferença do valor no montante previsto no item 3.3.1 do Quadro Resumo.</Paragrafo>
                <Paragrafo><strong>§3º</strong> Todas as despesas inerentes à obtenção do financiamento, sejam elas de que natureza forem, tais como impostos, taxas bancárias, despesas com emolumentos/certidões, tabelionatos, registro de imóveis, honorários de despachantes, avaliações, etc., bem como todos os encargos e custos financeiros decorrentes do mútuo, tais como os juros incidentes sobre o valor financiado, correrão por conta e responsabilidade do(a) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>§4º</strong> Consoante versado anteriormente, o financiamento será postulado pelo(a) COMPRADOR(A) por sua iniciativa e risco, e somente lhe será concedido caso por ele(a) sejam satisfeitas as exigências cadastrais e documentais, as quais o(a) mesmo(a) declara conhecer e se obriga prontamente a satisfazê-las; de modo que a VENDEDORA não tem qualquer responsabilidade quanto aos dados fornecidos pelo(a) COMPRADOR(A) e tampouco se responsabiliza, principalmente, pela aprovação do crédito junto à Instituição Financeira.</Paragrafo>
                <Paragrafo><strong>§5º</strong> Fica perfeitamente claro e convencionado que na eventualidade do(a) COMPRADOR(A) não vir a ter êxito na obtenção do financiamento, caberá à VENDEDORA decidir pelo prosseguimento do negócio ou não, podendo para tanto realizar diligências para verificar a saúde financeira do(a) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>§6º</strong> Decidindo a VENDEDORA pelo prosseguimento do negócio, mesmo após ter sido negada a aprovação do financiamento para o(a) COMPRADOR(A), este deverá pagar com recursos próprios para à VENDEDORA, observando as disposições do item 3.2 do Quadro Resumo.</Paragrafo>
            </Clausula>

            <Clausula titulo="DO INADIMPLEMENTO">
                <Paragrafo><strong>CLÁUSULA 6º.</strong> Não sendo pagas as parcelas mencionadas no Quadro Resumo na data prevista, estas ficarão sujeitas, até o seu respectivo pagamento, à correção monetária pelo índice previsto anteriormente, acrescidas de juros de mora de 1% (um por cento), mais multa no importe de 2% (dois por cento) sobre o valor vencido e não pago.</Paragrafo>
                <Paragrafo><strong>§1º</strong> As sanções aqui previstas serão aplicadas automaticamente em caso de inadimplência de qualquer uma das parcelas, não sendo necessária a ocorrência de notificação ou interpelação, judicial ou extrajudicial.</Paragrafo>
                <Paragrafo><strong>§2º</strong> Fica assegurado ao(à) COMPRADOR(A) o prazo de 15 (quinze) dias corridos, contados do dia posterior ao vencimento da parcela, para purgar a mora.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 7º.</strong> A aplicação da penalidade aqui expressa não impede o exercício do direito de retomada da posse pela VENDEDORA em razão do inadimplemento de 3 (três) parcelas, consecutivas ou não, nos termos da Cláusula 13ª deste contrato, bem como a rescisão contratual também prevista neste contrato na Cláusula 22ª.</Paragrafo>
                <Paragrafo><strong>PARÁGRAFO ÚNICO.</strong> Na situação prevista no caput deste artigo, o(a) COMPRADOR(A) será notificado pela VENDEDORA para purgar a mora dentro do prazo de 10 (dez) dias, contados do recebimento da notificação. Não sendo efetuado o pagamento, serão aplicadas as penalidades previstas nesta Cláusula.</Paragrafo>
            </Clausula>

            <Clausula titulo="DA COMISSÃO DE CORRETAGEM">
                <Paragrafo><strong>CLÁUSULA 8º.</strong> Em razão da intermediação do negócio aqui firmado, fica estabelecido o pagamento da comissão de corretagem pelo(a) COMPRADOR(A), conforme dados previstos no Quadro Resumo.</Paragrafo>
                <Paragrafo><strong>§1º</strong> O(A) COMPRADOR(A) declara expressamente a sua ciência sobre o não englobamento da comissão de corretagem ao preço da(s) unidade(s) imobiliária(s) objeto deste contrato, tratando-se de valores distintos e independentes entre si.</Paragrafo>
                <Paragrafo><strong>§2º</strong> Em caso de inadimplência do(a) COMPRADOR(A) no que diz respeito ao pagamento da comissão aqui prevista, a VENDEDORA não se responsabiliza pelo pagamento, cabendo ao corretor tomar as devidas providências judiciais e extrajudiciais que entender serem necessárias.</Paragrafo>
            </Clausula>
            
            <Clausula titulo="DO PRAZO E DA EXECUÇÃO DAS OBRAS">
                <Paragrafo><strong>CLÁUSULA 9º.</strong> A conclusão das obras da(s) unidade(s) imobiliária(s) deverá acontecer dentro do prazo previsto no Quadro Resumo.</Paragrafo>
                <Paragrafo><strong>PARÁGRAFO ÚNICO.</strong> Fica estipulada que eventual alteração no prazo do cronograma físico-financeiro, também vinculará a data da entrega do EMPREENDIMENTO.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 10º.</strong> Não ocorrendo a conclusão da obra dentro do prazo previsto na Quadro Resumo, fica garantido à VENDEDORA a tolerância de até 180 (cento e oitenta) dias corridos além prazo previsto, salvo motivos de caso fortuito ou força maior, não havendo necessidade de concordância do(a) COMPRADOR(A) para tanto.</Paragrafo>
                <Paragrafo><strong>PARÁGRAFO ÚNICO.</strong> Serão consideradas situações de caso fortuito e força maior, greves, falta de materiais no mercado ou de mão de obra qualificada, chuvas prolongadas, demoras atreladas a órgãos de serviços públicos para conseguir autorizações e licenças necessárias para a execução da obra que não dependam da VENDEDORA, demora na concessão de habite-se por fato não atribuível à VENDEDORA, pandemias, demandas judiciais que envolvam o terreno e que impeçam o uso natural do IMÓVEL, demora atrelada à Junta Comercial de Minas Gerais e que não seja atribuível à VENDEDORA, eventual embargo da obra, dentre outras situações sobre as quais a VENDEDORA não possui meios para controlar e que possam direta ou indiretamente prejudicar ou impedir o cumprimento integral da obrigação assumida.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 11º.</strong> A VENDEDORA se compromete a seguir as diretrizes dos projetos arquitetônicos aprovados pelos órgãos municipais.</Paragrafo>
                <Paragrafo><strong>§1º</strong> Poderá a VENDEDORA, em razão de conveniência técnica ou por determinação do poder público, promover modificações no projeto aprovado, independentemente de realização de consulta ao(à) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>§2º</strong> Na situação prevista no parágrafo anterior, não caberá ao(à) COMPRADOR(A) direito a indenização ou qualquer tipo de compensação.</Paragrafo>
            </Clausula>

            <Clausula titulo="DA IMISSÃO NA POSSE">
                <Paragrafo><strong>CLÁUSULA 12º.</strong> Fica acordado entre as partes que o(a) COMPRADOR(A) será imitido(a) na posse da(s) unidade(s) adquirida(s) por ele(a) somente após a finalização das obras e com a emissão do habite-se pelo município.</Paragrafo>
                <Paragrafo><strong>§1º</strong> A imissão na posse pelo(a) COMPRADOR(A) apenas acontecerá se este estiver com o pagamento em dia de todas as parcelas assumidas, bem como com as demais obrigações consentidas ao longo deste contrato.</Paragrafo>
                <Paragrafo><strong>§2º</strong> Uma vez que o(a) COMPRADOR(A) fique imitido(a) na posse, a VENDEDORA estará eximida da responsabilidade pelo pagamento de tributos e despesas inerentes ao IMÓVEL, tais como IPTU, taxa de lixo, taxa de condomínio, contas de águas e luz, dentre outras, passando estas a serem de responsabilidade exclusiva do(a) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 13º.</strong> Caso o(a) COMPRADOR(A) se torne inadimplente em razão do descumprimento dos pagamentos das parcelas e já tendo sido imitido(a) na posse, a VENDEDORA poderá se valer do direito de retomada da posse da(s) unidade(s) descrita(s) no Quadro Resumo, não tendo o(a) COMPRADOR(A) direito a retenção ou indenização de possíveis benfeitorias, valendo este instrumento como título executivo de obrigação de fazer (restituir o bem).</Paragrafo>
            </Clausula>

            <Clausula titulo="DOS DIREITOS E OBRIGAÇÕES DAS PARTES">
                <Paragrafo><strong>CLÁUSULA 14º.</strong> São obrigações da VENDEDORA:</Paragrafo>
                <ItemLista numero="I.">Realizar a construção das obras do EMPREENDIMENTO, conforme projeto aprovado pelo município;</ItemLista>
                <ItemLista numero="II.">Empenhar os melhores esforços para finalização da obra dentro do prazo previsto no Quadro Resumo;</ItemLista>
                <ItemLista numero="III.">Entregar a posse da(s) unidade(s) descrita(s) no Quadro Resumo para o(a) COMPRADOR(A), nos termos da Cláusula 12ª deste Contrato, sem oposição nem embaraços.</ItemLista>
                <Paragrafo><strong>CLÁUSULA 15º.</strong> São obrigações do(a) COMPRADOR(A):</Paragrafo>
                <ItemLista numero="I.">Realizar os pagamentos da forma e nas datas previstas no Quadro Resumo;</ItemLista>
                <ItemLista numero="II.">Realizar o pagamento da comissão de corretagem conforme especificado no Quadro Resumo;</ItemLista>
                <ItemLista numero="III.">Arcar com todas as despesas para outorga da Escritura Pública de Compra e Venda;</ItemLista>
                <ItemLista numero="IV.">Assumir, após a imissão na posse, todas as despesas inerentes à(a) unidade(s) descrita(s) no Quadro Resumo, tais como contas de energia, água, IPTU, taxa condominial etc.;</ItemLista>
                <ItemLista numero="V.">Respeitar todos os termos da Convenção de Condomínio e do Regimento Interno, quando aprovado;</ItemLista>
                <ItemLista numero="VI.">Em caso de resolução contratual em razão de inadimplemento, entregar a posse da(s) unidade(s) descrita(s) no Quadro Resumo sem que haja a necessidade de interpelação judicial para tanto.</ItemLista>
                <Paragrafo><strong>CLÁUSULA 16º.</strong> O(A) COMPRADOR(A) não poderá interferir, direta ou indiretamente, no andamento normal das obras do EMPREENDIMENTO, nem solicitar modificações nos projetos durante a execução das obras.</Paragrafo>
                <Paragrafo><strong>PARÁGRAFO ÚNICO.</strong> Uma vez imitido na posse, o(a) COMPRADOR(A) deverá submeter qualquer projeto de reformas, reparos, instalações ou retiradas em geral nas áreas privativas ao síndico ou, na sua falta, ao subsíndico ou à administradora.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 17º.</strong> Poderá o(a) COMPRADOR(A) realizar visitação na(s) unidade(s) adquirida(s) por ele(a), desde que previamente agendada junto à VENDEDORA, cabendo a estas julgarem aspectos de conveniência e relevância quanto à visitação, conforme suas disponibilidades, não se obrigando, entretanto, à realização de tal agendamento.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 18º.</strong> Fica expressamente proibida a cessão ou transferência de direitos deste Contrato pelo(a) COMPRADOR(A) a terceiros, sem a anuência da VENDEDORA, sendo considerada inválida tal transferência e não desobrigando o(a) COMPRADOR(A) de todas a obrigações aqui assumidas.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 19º.</strong> Fica expressamente proibida a alienação de garagens privativas autônomas, que compõe o EMPREENDIMENTO, para terceiros.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 20º.</strong> Caberá ao(à) COMPRADOR(A), quando se tratar de casos de alienação, locação (inclusive de curto prazo), cessão, comodato e outros que importem na transferência de direitos relativos ao condomínio ou das unidades autônomas, cientificar a terceiros acerca da Convenção de Condomínio e do Regimento Interno, obrigando-os a respeitar todas as disposições contidas nestes instrumentos.</Paragrafo>
            </Clausula>
            
            <Clausula titulo="DA CLÁUSULA PENAL">
                 <Paragrafo><strong>CLÁUSULA 21º.</strong> O descumprimento das cláusulas previstas neste Contrato acarretará a aplicação da Cláusula Penal no importe de 10% (dez por cento) sobre o valor total especificado no Quadro Resumo, sendo a multa será suportada pela parte que der causa à inexecução contratual.</Paragrafo>
                 <Paragrafo><strong>PARÁGRAFO ÚNICO.</strong> O descumprimento das obrigações assumidas pelo(a) COMPRADOR(A) não impede que a parte que descumpriu as obrigações impostas neste contrato seja demandada judicialmente pela parte prejudicada.</Paragrafo>
            </Clausula>
            
            <Clausula titulo="DA RESCISÃO CONTRATUAL">
                <Paragrafo><strong>CLÁUSULA 22º.</strong> O presente Contrato ficará rescindido nas seguintes situações:</Paragrafo>
                <ItemLista numero="I.">Por mútuo acordo entre as partes;</ItemLista>
                <ItemLista numero="II.">Em razão de inadimplemento de 3 (três) parcelas, consecutivas ou não;</ItemLista>
                <ItemLista numero="III.">Descumprimento de cláusulas deste Contrato pelo(a) COMPRADOR(A) que impeça seu prosseguimento.</ItemLista>
                <Paragrafo><strong>§ 1º.</strong> Na hipótese prevista no inciso I desta Cláusula, ocorrerá a rescisão contratual sem a incidência da Cláusula Penal, devendo a VENDEDORA permanecer com o valor líquido que recebeu, salvo se as partes acordarem diversamente.</Paragrafo>
                <Paragrafo><strong>§ 2º.</strong> Na hipótese dos incisos II e III, ocorrerá a rescisão contratual com a aplicação da Cláusula Penal sobre o valor total previsto no Quadro Resumo, além da ocorrência do exercício da retomada da posse, caso o(a) COMPRADOR(A) já esteja imitido(a) nela.</Paragrafo>
                <Paragrafo><strong>§ 3º.</strong> Ocorrendo a rescisão em razão do exposto nos incisos II e III, além da aplicação da multa expressa no parágrafo anterior, ficará retido 25% (vinte e cinco por cento) de todo o valor que tenha sido pago pelo(a) VENDEDOR(A).</Paragrafo>
                <Paragrafo><strong>§ 4º.</strong> Em todas as situações expostas nos incisos dessa Cláusula, ocorrerá a retenção do valor pago a título de comissão de corretagem pelo(a) COMPRADOR(A).</Paragrafo>
                <Paragrafo><strong>§ 5º.</strong> Na hipótese do(a) COMPRADOR(A) já ter sido imitido(a) na posse da(s) unidade(s) descrita(s) no Quadro Resumo, além do previsto nos parágrafos anteriores, este(a) responderá ainda pelos impostos incidentes sobre aqueles bens imóveis, pelas contribuições condominiais, além do percentual de 0,5% sobre o valor atualizado deste contrato, pro rata die, por ter usufruído deles.</Paragrafo>
                <Paragrafo><strong>§ 6º.</strong> A VENDEDORA independentemente do motivo da rescisão deste Contrato, poderá revender a(s) unidade(s) adquirida(s) pelo(a) COMPRADOR(A) a outrem.</Paragrafo>
            </Clausula>
            
            <Clausula titulo="DO DIREITO AO ARREPENDIMENTO">
                <Paragrafo><strong>CLÁUSULA 23º.</strong> O(A) COMPRADOR(A) poderá exercer o seu direito ao arrependimento dentro do prazo improrrogável de 7 (sete) dias, contados da assinatura do presente instrumento contratual, caso o presente negócio tenha acontecido em estandes de vendas ou fora da sede da VENDEDORA.</Paragrafo>
                <Paragrafo><strong>§ 1º.</strong> Nessa situação, será devolvido pela VENDEDORA para o(a) COMPRADOR(A), todo o valor que tenha sido efetivamente pago, inclusive a comissão de corretagem, dentro do prazo previsto no quadro resumo.</Paragrafo>
                <Paragrafo><strong>§ 2º.</strong> O valor deverá ser devolvido para a conta bancária prevista no quadro resumo.</Paragrafo>
            </Clausula>

            <Clausula titulo="DA COMUNICAÇÃO ENTRE AS PARTES">
                <Paragrafo><strong>CLÁUSULA 24º.</strong> Qualquer notificação ou comunicação exigida ou permitida de acordo com o presente Contrato deverá ser realizada por escrito e será considerada como entregue: (i) pessoalmente à parte mediante protocolo, ou (ii) se enviada por mensageiro, e-mail com confirmação de recebimento e/ou correspondência com aviso de recebimento, para os e-mails, telefones e endereços previstos no Quadro Resumo.</Paragrafo>
            </Clausula>

            <Clausula titulo="DAS DISPOSIÇÕES PROCESSUAIS E FINAIS">
                <Paragrafo><strong>CLÁUSULA 25º.</strong> Execução: Conforme o disposto no artigo 784, III, do Código de Processo Civil, este instrumento constitui título executivo extrajudicial, idôneo para com ele, qualquer das partes compelir a outra ao cumprimento forçado da obrigação.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 26º.</strong> Comunicação: Fica acordado, ainda, que, para todas as razões de Direito, terá validade, como meio alternativo de comunicação, a citação/notificação/interpelação via e-mail, mensagem e endereços fornecidos no capítulo próprio, ficando a parte que alterar seu endereço com a obrigação de comunicar tal fato a outra parte, sob pena de se considerar citado/notificado/intimado pelo simples recebimento de comunicado em algum dos meios/endereços informados no preâmbulo.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 27º.</strong> Negócio jurídico processual: Ante o permissivo contido no artigo 190 do Código de Processo Civil, as partes pactuam procedimento próprio para demandas eventualmente oriundas do presente contrato, ficando os referidos e eventuais processos sujeitos às seguintes disposições:</Paragrafo>
                <ItemLista numero="I.">Os contratantes elegem este contrato como prova absoluta da plausibilidade dos direitos nele tratados ou dele decorrentes, para fins de concessão da tutela provisória da evidência, referida no artigo 311 do Código de Processo Civil;</ItemLista>
                <ItemLista numero="II.">Renunciam os contratantes ao direito de discutir a validade, legalidade, eficácia, veracidade, autonomia da vontade ou onerosidade no tocante às cláusulas e disposições deste instrumento;</ItemLista>
                <ItemLista numero="III.">Pactuam a validade da prova produzida extrajudicialmente, desde que produzida no foro deste contrato e com respeito ao contraditório, considerando-se respeitado se o contratante, validamente notificado com antecedência mínima de 15 (quinze) dias úteis para participar do ato de produção da prova ou informar impossibilidade de comparecimento, não comparecer ou se fizer representar no ato de produção da prova;</ItemLista>
                <Paragrafo><strong>CLÁUSULA 28º.</strong> Tolerância: Fica pactuado que o aditamento deste contrato far-se-á exclusivamente pela via escrita, por meio de aditivo assinado pelas partes e coobrigados, sendo sem efeito o aditivo verbal ou tácito, não havendo, assim, aquisição de direito por liberalidade da outra parte ou inércia no exercício de prerrogativa contratual.</Paragrafo>
                <Paragrafo><strong>CLÁUSULA 29º.</strong> Foro: As partes elegem o foro da comarca de Governador Valadares/MG, quaisquer que sejam seus domicílios, para dirimir todas as controvérsias porventura imanentes deste pacto, com expressa renúncia a qualquer outro foro, por mais especial que seja.</Paragrafo>
            </Clausula>

            <Paragrafo className="text-sm text-justify mt-6">
                E por ser firme e justo, da livre e desembaraçada vontade das partes contratantes, é que assinam o presente em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.
            </Paragrafo>
        </>
    );
}