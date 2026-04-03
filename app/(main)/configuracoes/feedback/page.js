export const dynamic = 'force-dynamic';
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
 <Link href="/configuracoes/feedback/enviar" className="block group animate-in fade-in zoom-in-95 duration-300">
 <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-start gap-4 cursor-pointer">
 <div className="bg-blue-50 p-4 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
 <FontAwesomeIcon icon={faPaperPlane} className="text-3xl" />
 </div>
 <div>
 <h2 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-700 transition-colors">Enviar um Feedback</h2>
 <p className="text-sm text-gray-500 leading-relaxed">Encontrou um problema ou tem uma sugestão? Envie para a nossa equipe de desenvolvimento e nos ajude a melhorar.</p>
 </div>
 </div>
 </Link>

 {/* Card para Visualizar Feedbacks (Apenas para Proprietário) */}
 {isProprietario && (
 <Link href="/configuracoes/feedback/visualizar" className="block group animate-in fade-in zoom-in-95 duration-300 delay-75">
 <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-start gap-4 cursor-pointer">
 <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
 <FontAwesomeIcon icon={faListCheck} className="text-3xl" />
 </div>
 <div>
 <h2 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-emerald-700 transition-colors">Visualizar Feedbacks</h2>
 <p className="text-sm text-gray-500 leading-relaxed">Acesse a lista completa de todos os feedbacks, problemas e sugestões enviados pelos usuários do sistema.</p>
 </div>
 </div>
 </Link>
 )}
 </div>
 </div>
 );
}