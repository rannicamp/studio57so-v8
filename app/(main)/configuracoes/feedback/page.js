import Link from 'next/link';
import { createClient } from '../../../../utils/supabase/server';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faListCheck } from '@fortawesome/free-solid-svg-icons';

export default async function FeedbackHubPage() {
  // CORREÇÃO: Adicionado 'await' aqui
  const supabase = await createClient();
  let isProprietario = false;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: adminData } = await supabase
      .from('usuarios')
      .select('funcoes(nome_funcao)')
      .eq('id', user.id)
      .single();
    isProprietario = adminData?.funcoes?.nome_funcao === 'Proprietário';
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Central de Feedback</h1>
        <p className="mt-2 text-gray-600">
          Envie sugestões e relate problemas ou visualize os feedbacks recebidos dos usuários.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card para Enviar Feedback */}
        <Link href="/configuracoes/feedback/enviar" className="block group">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
            <FontAwesomeIcon icon={faPaperPlane} className="text-3xl text-blue-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Enviar um Feedback</h2>
            <p className="text-sm text-gray-600">Encontrou um problema ou tem uma sugestão? Envie para a equipe de desenvolvimento.</p>
          </div>
        </Link>

        {/* Card para Visualizar Feedbacks (Apenas para Proprietário) */}
        {isProprietario && (
          <Link href="/configuracoes/feedback/visualizar" className="block group">
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
              <FontAwesomeIcon icon={faListCheck} className="text-3xl text-green-500 mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Visualizar Feedbacks</h2>
              <p className="text-sm text-gray-600">Acesse a lista de todos os feedbacks enviados pelos usuários do sistema.</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}