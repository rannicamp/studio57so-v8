const fs = require('fs');
let code = fs.readFileSync('app/(landingpages)/betasuites/manual-corretor/ManualCorretorA5Client.js', 'utf8');

const replaceAll = (str, find, replace) => str.split(find).join(replace);

code = replaceAll(code, 'ManualCorretorA5Client', 'ManualCorretorAlfaClient');
code = replaceAll(code, 'Beta Suítes', 'Residencial Alfa');
code = replaceAll(code, 'BETA SUÍTES', 'RESIDENCIAL ALFA');
code = replaceAll(code, 'beta_sunset_fachada.jpeg', 'alfa_fachada_placeholder.jpeg'); 

code = replaceAll(code, 'O Residencial Alfa não é apenas um apartamento; é uma <strong className=\"text-gray-900 text-[14px]\">máquina de rentabilidade</strong>. Ele representa a oportunidade perfeita para investidores que buscam retorno financeiro rápido, proteção patrimonial e alta liquidez no Alto Esplanada.', 'O Residencial Alfa é a materialização de <strong className=\"text-gray-900 text-[14px]\">qualidade de vida e rentabilidade patrimonial sólida</strong>. Ele foi estrategicamente posicionado no Alto Esplanada para oferecer segurança, prestígio e proximidade aos principais polos da cidade.');

code = replaceAll(code, 'Rua das Araras, Nº 461 - Alto Esplanada', 'Avenida Doutor Sérvulo Teixeira, 725 - Alto Esplanada');

code = replaceAll(code, 'São 42 Apartamentos Studios, com plantas otimizadas variando de <strong>28,95m² a 31,77m²</strong>. O empreendimento possui 36 vagas totais (21 para Carros e 15 para Motos). As vagas possuem <strong>matrículas individualizadas</strong>, ou seja, são adquiridas separadamente da unidade principal.', 'São 41 produtos no projeto (apartamentos, lojas e garagens). O sucesso comercial é absoluto: <strong>32 unidades já vendidas</strong>. Restam apenas 4 Apartamentos (49,76m²), 1 Loja Comercial e 4 Vagas Avulsas para negociação imediata.');

code = replaceAll(code, 'Terraço Gourmet no topo (Piscina de Borda Infinita, Espaço Gourmet e Academia). Estrutura projetada para aumentar exponencialmente a diária do Airbnb e o aluguel.', 'Estrutura moderna no Alto Esplanada, com foco em uma vida prática e segura. Em Obras Aceleradas com previsão de entrega para Setembro de 2027.');

code = replaceAll(code, 'O perfil de quem vai alugar do seu cliente investidor: jovens executivos, residentes de medicina e universitários. Lembre-se também que Governador Valadares é um polo regional, atraindo diariamente pessoas de cidades vizinhas para exames e compras. O tamanho da suíte é perfeitamente adequado ao objetivo a que se propõe: praticidade e conforto para essa demanda contínua.', 'O Residencial Alfa atrai famílias buscando segurança em bairro nobre, casais em busca do primeiro imóvel com liquidez, e investidores focados em aluguel tradicional no Alto Esplanada. A metragem (49,76m²) é o ponto de equilíbrio perfeito: prático de manter e com ótima revenda.');

code = replaceAll(code, 'Podem ser parceladas em até 42 vezes', 'Pagamento diluído confortavelmente ao longo de 36 parcelas acompanhando o avanço da obra');

code = replaceAll(code, 'O aluguel no Alto Esplanada tem alta rentabilidade, pagando facilmente a parcela de um futuro financiamento bancário (Repasse) e gerando sobra de caixa. Zero descapitalização violenta.', 'Quitação apenas no final do projeto (Pós-Habite-se). É o momento ideal para assumir um financiamento bancário, quando o imóvel já estará supervalorizado.');

code = replaceAll(code, 'A Matemática', 'O Gatilho');
code = replaceAll(code, 'Da Rentabilidade', 'Da Escassez');

code = replaceAll(code, 'O formato Studio foi desenhado para maximizar o valor da locação. Baseado no mercado do Alto Esplanada e plataformas de temporada, um Studio decorado tem valor de diária conservador de <strong>R$ 200,00</strong>.', 'O Residencial Alfa não é mais uma promessa – é o empreendimento de maior liquidez atual da Studio 57. Com 80% das unidades vendidas, a escassez trabalha a seu favor no momento da negociação.');

code = replaceAll(code, '\"O Residencial Alfa não é uma moradia definitiva para famílias, é um ativo financeiro. O tamanho das suítes de 30m² é totalmente adequado ao objetivo a que se propõe: diminui o preço de aquisição, derruba o custo de condomínio e atende exatamente a necessidade de um universitário, médico ou passante do polo regional. Você gasta pouco para mobiliar e aluga rápido.\"', '\"Pelo contrário, 49m² no Alto Esplanada é um produto raro e inteligente. Ele oferece o layout exato para maximizar a área útil sem o desperdício de corredores antigos. Isso garante um IPTU menor, custo de mobília reduzido e alta facilidade de revenda.\"');

code = replaceAll(code, '\"A localização blinda o seu investimento. Sendo vizinho da UFJF e do Polo Médico, todo semestre entram dezenas de novos estudantes e residentes precisando exatamente desse formato de moradia prática (com Terraço Gourmet e Lavanderia inclusos). O aluguel nesta região tem fila de espera, a renda é certa.\"', '\"A localização blinda o seu investimento. A proximidade com centros universitários e hospitalares traz uma demanda natural contínua. Imóveis de quase 50m² no Esplanada não ficam vazios, eles alugam rápido ou são revendidos com ágio muito acima da inflação.\"');

fs.writeFileSync('app/(landingpages)/residencialalfa/manual-corretor/ManualCorretorAlfaClient.js', code);
console.log('Feito!');
