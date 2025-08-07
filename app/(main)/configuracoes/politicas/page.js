import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default function PoliticasDeUsoPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Link href="/configuracoes" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2 font-semibold">
        <FontAwesomeIcon icon={faArrowLeft} />
        Voltar para Configurações
      </Link>
      
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">Políticas e Termos de Uso</h1>

        {/* A classe "prose" ajuda a formatar o texto de forma agradável para leitura */}
        <div className="prose prose-lg max-w-none">
          
          <h2 className="!text-2xl !font-bold !mb-4">Termos de Uso do Sistema Studio 57</h2>
          <p className="text-sm text-gray-500">Última atualização: 07 de agosto de 2025</p>
          
          <p>Bem-vindo ao Sistema de Gestão Integrada do Studio 57. Ao acessar e utilizar esta plataforma, você, como usuário autorizado, concorda em cumprir e estar sujeito aos seguintes termos e condições de uso, que regem a relação do Studio 57 com você em relação a este software.</p>
          
          <h3 className="!font-semibold">1. Contas de Usuário e Segurança</h3>
          <p>O acesso ao sistema é concedido através de credenciais individuais (e-mail e senha). Você é inteiramente responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem sob sua conta. O nível de acesso às funcionalidades do sistema é determinado pela sua função ("role"), que é designada por um administrador do sistema.</p>

          <h3 className="!font-semibold">2. Uso Aceitável e Responsabilidades</h3>
          <p>Você concorda em utilizar o sistema exclusivamente para os fins comerciais legítimos do Studio 57. É estritamente proibido utilizar a plataforma para:</p>
          <ul>
            <li>Inserir informações que sejam falsas, imprecisas, fraudulentas ou enganosas.</li>
            <li>Fazer upload de documentos, fotos ou qualquer arquivo que contenha vírus, malware ou qualquer outro código malicioso.</li>
            <li>Tentar obter acesso não autorizado a dados, módulos ou funcionalidades para os quais sua função não concede permissão.</li>
            <li>Utilizar o sistema para qualquer finalidade ilegal, difamatória, ou que viole os direitos de privacidade ou propriedade intelectual de terceiros.</li>
          </ul>

          <h3 className="!font-semibold">3. Confidencialidade das Informações</h3>
          <p>Todas as informações contidas e gerenciadas por este sistema — incluindo, mas não se limitando a, dados de clientes, informações financeiras, dados de funcionários, orçamentos, relatórios diários de obra e estratégias de CRM — são consideradas informações confidenciais e propriedade exclusiva do Studio 57. A divulgação, cópia ou compartilhamento não autorizado dessas informações com terceiros externos à operação da empresa é estritamente proibida e estará sujeita às medidas disciplinares e legais cabíveis.</p>
          
          <h3 className="!font-semibold">4. Propriedade Intelectual</h3>
          <p>O software, o design, a estrutura, o código-fonte e todos os componentes visuais e funcionais deste sistema são propriedade intelectual do Studio 57, protegidos pelas leis de direitos autorais e propriedade industrial. Nenhuma parte do sistema pode ser copiada, reproduzida ou redistribuída sem permissão expressa.</p>

          <h3 className="!font-semibold">5. Limitação de Responsabilidade</h3>
          <p>O sistema é fornecido "como está". Embora nos esforcemos para manter a plataforma segura, precisa e disponível, não garantimos que o serviço será ininterrupto ou livre de erros. O Studio 57 не se responsabiliza por quaisquer perdas de dados, interrupções de negócios ou danos diretos ou indiretos resultantes do uso ou da incapacidade de uso da plataforma.</p>

          <hr className="my-10" />

          <h2 className="!text-2xl !font-bold !mb-4">Política de Privacidade</h2>
          <p className="text-sm text-gray-500">Última atualização: 07 de agosto de 2025</p>

          <p>Esta Política de Privacidade descreve como o Studio 57 coleta, utiliza e protege as informações inseridas no nosso Sistema de Gestão Integrada.</p>

          <h3 className="!font-semibold">1. Tipos de Dados Coletados</h3>
          <p>Coletamos e processamos informações que você nos fornece diretamente ao utilizar o sistema, incluindo:</p>
          <ul>
            <li>**Dados de Identificação Pessoal:** Nome, CPF, RG, data de nascimento, e-mail, telefone, endereço, estado civil (para contatos e funcionários).</li>
            <li>**Dados Corporativos:** Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual/Municipal (para empresas e contatos PJ).</li>
            <li>**Dados Financeiros:** Lançamentos de receitas e despesas, dados de contas bancárias, orçamentos de obras, salários e informações de pagamento de funcionários.</li>
            <li>**Dados Profissionais:** Informações contratuais de funcionários, cargo, data de admissão, jornada de trabalho e registros de ponto.</li>
            <li>**Conteúdo Gerado pelo Usuário:** Arquivos, documentos (contratos, notas fiscais, etc.), fotos de perfil, fotos de RDOs, ocorrências de obra e mensagens trocadas através do módulo de CRM (WhatsApp).</li>
          </ul>

          <h3 className="!font-semibold">2. Finalidade do Uso dos Dados</h3>
          <p>Utilizamos os dados coletados exclusivamente para as finalidades operacionais do Studio 57, tais como:</p>
          <ul>
            <li>Operar e manter as funcionalidades do sistema de gestão.</li>
            <li>Gerenciar projetos, finanças, contatos (CRM), funcionários e recursos humanos.</li>
            <li>Automatizar processos, como a criação de eventos em agendas e a análise de dados financeiros.</li>
            <li>Garantir a segurança, a integridade e o bom funcionamento de nossos serviços.</li>
          </ul>

          <h3 className="!font-semibold">3. Compartilhamento de Dados com Serviços de Terceiros</h3>
          <p>Para fornecer funcionalidades avançadas, nosso sistema se integra com serviços de terceiros. Ao usar essas funcionalidades, você concorda que os dados necessários sejam compartilhados com:</p>
          <ul>
            <li>**Supabase:** Utilizado como nosso provedor de banco de dados e armazenamento de arquivos em nuvem. Todos os dados do sistema são armazenados de forma segura em sua infraestrutura.</li>
            <li>**Google (Gemini AI e Google Calendar):** Dados de projetos, financeiros, documentos e atividades podem ser enviados de forma anônima para a API do Google Gemini (a IA "Stella") para gerar resumos, análises e insights. Se você conectar sua conta Google, o sistema criará eventos na sua agenda pessoal com base nas atividades cadastradas.</li>
            <li>**Meta (WhatsApp Business API):** Utilizada para o funcionamento do módulo de CRM, permitindo o envio e recebimento de mensagens diretamente pela plataforma. As conversas são armazenadas para registro e gestão de relacionamento com o cliente.</li>
            <li>**ViaCEP:** Utilizamos este serviço para preencher automaticamente campos de endereço a partir de um CEP, agilizando o cadastro.</li>
          </ul>
          <p>Nós nos comprometemos a utilizar apenas parceiros que demonstrem um alto nível de segurança e conformidade com as leis de proteção de dados.</p>

          <h3 className="!font-semibold">4. Segurança dos Dados</h3>
          <p>Implementamos medidas técnicas e organizacionais para proteger suas informações, incluindo controle de acesso baseado em funções, criptografia de dados em trânsito e em repouso, e o uso de provedores de infraestrutura seguros. O acesso aos dados é estritamente limitado aos usuários com as permissões necessárias para suas funções.</p>

          <h3 className="!font-semibold">5. Seus Direitos e Contato</h3>
          <p>Você tem o direito de acessar e corrigir suas informações pessoais através das funcionalidades do sistema, como a página "Meu Perfil" ou os formulários de edição. Para questões relacionadas à exclusão de dados ou outras dúvidas sobre esta política, entre em contato com a administração do Studio 57.</p>
        </div>
      </div>
    </div>
  );
}