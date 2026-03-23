import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faCrown } from '@fortawesome/free-solid-svg-icons';
import FeedbackKanban from '@/components/feedback/FeedbackKanban';

export const dynamic = 'force-dynamic';

export default async function AdminMasterFeedbacks() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // Buscando dados cruciais do Admin Logado
    const { data: adminData } = await supabase
        .from('usuarios')
        .select('funcoes ( nome_funcao ), organizacao_id')
        .eq('id', user.id)
        .single();
        
    // ABRINDO PARA GESTORES ALÉM DE PROPRIETÁRIOS - SOMENTE DA MATRIZ (ORG 1)
    const rolesPermitidas = ['Proprietário', 'Diretor', 'Gerente', 'Administrador'];
    if (!rolesPermitidas.includes(adminData?.funcoes?.nome_funcao) || adminData.organizacao_id !== 1) {
        redirect('/'); // Se não for da Elo 57 (Matriz), Vaza!
    }

    // Carregando Feedbacks de TODAS as Organizações
    const { data: feedbacks, error } = await supabase
        .from('feedback')
        .select(`
            id, descricao, pagina, status, created_at, link_opcional, imagem_url,
            usuario:usuarios ( nome, sobrenome, email, organizacao_id )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao carregar tickets globais:", error);
    }

    return (
        <div className="space-y-6 w-full max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-500">
            {/* Cabeçalho Minimalista Studio 57 */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-2 gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-gray-400 hover:text-amber-600 transition-colors" title="Voltar">
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </Link>
                    <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faCrown} className="text-amber-400" />
                        Master Kanban - Ideias & Bugs
                    </h2>
                </div>
                <p className="text-gray-500 font-medium ml-9">CRM Mestre unificado do Studio 57. Central de tramitação de tickets de todas as organizações.</p>
              </div>
            </div>

            {/* Aqui nós PASSAMOS isReadOnly = false (Default) para liberar o arrasto/botões */}
            <FeedbackKanban initialFeedbacks={feedbacks || []} />
        </div>
    );
}
