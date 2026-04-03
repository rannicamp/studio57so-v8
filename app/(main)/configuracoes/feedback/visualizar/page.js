import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import FeedbackKanban from '@/components/feedback/FeedbackKanban';

export const dynamic = 'force-dynamic';

export default async function VisualizarFeedbackPage() {
 const supabase = await createClient();

 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 redirect('/login');
 }

 // Buscando dados cruciais do LoggedUser
 const { data: adminData } = await supabase
 .from('usuarios')
 .select('funcoes ( nome_funcao ), organizacao_id')
 .eq('id', user.id)
 .single();
 // ABRINDO PARA GESTORES ALÉM DE PROPRIETÁRIOS
 const rolesPermitidas = ['Proprietário', 'Diretor', 'Gerente', 'Administrador'];
 if (!rolesPermitidas.includes(adminData?.funcoes?.nome_funcao)) {
 redirect('/');
 }

 // Carregando Feedbacks Exclusivos da Própria Organização do Usuário + Usuário Relator
 // Seguindo a diretriz: "cada organização vai poder ver os feedbacks que enviou"
 const { data: feedbacks, error } = await supabase
 .from('feedback')
 .select(`
 id, descricao, pagina, status, created_at,
 usuario:usuarios ( nome, sobrenome, email )
 `)
 .eq('organizacao_id', adminData.organizacao_id)
 .order('created_at', { ascending: false });

 if (error) {
 console.error("Erro ao carregar tickets de melhoria:", error);
 }

 return (
 <div className="space-y-6 w-full max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-500">
 {/* Cabeçalho Minimalista Studio 57 */}
 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-2 gap-4">
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-3">
 <Link href="/configuracoes" className="text-gray-400 hover:text-blue-600 transition-colors" title="Voltar às Configurações">
 <FontAwesomeIcon icon={faChevronLeft} />
 </Link>
 <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
 Ideias e Feedbacks
 </h2>
 </div>
 <p className="text-gray-500 font-medium ml-6">Quadro vivo de melhorias contínuas enviadas pelo time da sua organização.</p>
 </div>
 </div>

 <FeedbackKanban initialFeedbacks={feedbacks || []} isReadOnly={true} />
 </div>
 );
}