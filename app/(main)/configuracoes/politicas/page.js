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

        <div className="prose prose-lg max-w-none">
          
          <h2 className="!text-2xl !font-bold !mb-4">Termos de Uso do Sistema Studio 57</h2>
          <p className="text-sm text-gray-500">Última atualização: 07 de agosto de 2025</p>
          
          <p>Bem-vindo ao Sistema de Gestão Integrada do Studio 57. Ao acessar e utilizar esta plataforma, você concorda em cumprir e estar sujeito aos seguintes termos e condições de uso.</p>
          
          <h3 className="!font-semibold">1. Contas de Usuário</h3>
          <p>O acesso ao sistema é restrito a usuários autorizados. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem em sua conta. O acesso e as permissões são definidos pela sua função, determinada pela administração.</p>

          <h3 className="!font-semibold">2. Uso Aceitável</h3>
          <p>Você concorda em usar o sistema apenas para fins comerciais legítimos do Studio 57. É estritamente proibido inserir informações falsas, realizar upload de arquivos maliciosos ou tentar obter acesso não autorizado.</p>

          <h3 className="!font-semibold">3. Confidencialidade</h3>
          <p>Todas as informações contidas neste sistema, incluindo dados de clientes, informações financeiras, dados de funcionários e detalhes de projetos, são consideradas confidenciais e propriedade do Studio 57. A divulgação não autorizada dessas informações é estritamente proibida e sujeita às medidas legais cabíveis.</p>
          
          <h3 className="!font-semibold">4. Propriedade Intelectual</h3>
          <p>O software, design, layout e todos os componentes do sistema são propriedade intelectual do Studio 57 e protegidos por leis de direitos autorais.</p>

          <h3 className="!font-semibold">5. Limitação de Responsabilidade</h3>
          {/* CORREÇÃO APLICADA AQUI */}
          <p>O sistema é fornecido &apos;como está&apos;. O Studio 57 não se responsabiliza por perdas de dados ou danos resultantes do uso (ou da incapacidade de uso) da plataforma.</p>

          <hr className="my-10" />

          <h2 className="!text-2xl !font-bold !mb-4">Política de Privacidade</h2>
          <p className="text-sm text-gray-500">Última atualização: 07 de agosto de 2025</p>

          <h3 className="!font-semibold">1. Coleta de Dados</h3>
          <p>Coletamos informações que você nos fornece diretamente ao utilizar o sistema, incluindo:</p>
          <ul>
            <li>**Dados de Identificação:** Nome, CPF, CNPJ, e-mail, telefone.</li>
            <li>**Dados Financeiros:** Informações de lançamentos, orçamentos, salários.</li>
            <li>**Dados Profissionais:** Informações de funcionários, cargos, jornadas de trabalho.</li>
            <li>**Conteúdo Gerado pelo Usuário:** Uploads, documentos, fotos e mensagens.</li>
          </ul>

          <h3 className="!font-semibold">2. Uso dos Dados</h3>
          <p>Utilizamos seus dados para operar e manter as funcionalidades do sistema, gerenciar projetos, finanças, contatos e recursos humanos, e para garantir a segurança da plataforma.</p>

          <h3 className="!font-semibold">3. Compartilhamento com Terceiros e IA</h3>
          <p>Para fornecer nossos serviços, compartilhamos dados com parceiros como Supabase (armazenamento), Google (IA Stella e Calendar) e Meta (WhatsApp). Comprometemo-nos a utilizar apenas parceiros que demonstrem conformidade com as leis de proteção de dados.</p>

          <h3 className="!font-semibold">4. Segurança dos Dados</h3>
          <p>Implementamos medidas de segurança como controle de acesso baseado em funções e criptografia para proteger suas informações contra acesso, alteração ou divulgação não autorizada.</p>

          <h3 className="!font-semibold">5. Seus Direitos</h3>
          {/* CORREÇÃO APLICADA AQUI */}
          <p>Você tem o direito de acessar e corrigir suas informações pessoais através da página &apos;Meu Perfil&apos;. Para exclusão de dados, entre em contato com a administração, sujeito às políticas de retenção de dados da empresa.</p>

        </div>
      </div>
    </div>
  );
}