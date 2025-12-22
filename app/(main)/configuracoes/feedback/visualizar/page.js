import { createClient } from '../../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import FeedbackList from '../../../../../components/FeedbackList';

export const dynamic = 'force-dynamic';

export default async function VisualizarFeedbackPage() {
    const supabase = await createClient();

    // Proteção de Rota
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    const { data: adminData } = await supabase
        .from('usuarios')
        .select('funcoes ( nome_funcao )')
        .eq('id', user.id)
        .single();

    if (adminData?.funcoes?.nome_funcao !== 'Proprietário') {
        redirect('/');
    }

    // Busca os feedbacks e os dados do usuário que enviou
    const { data: feedbacks, error } = await supabase
        .from('feedback')
        .select(`
            *,
            usuario:usuarios ( nome, sobrenome, email )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar feedbacks:", error);
    }

    return (
        <div className="space-y-6">
            <Link href="/configuracoes/feedback" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Central de Feedback
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Painel de Feedback</h1>
            <p className="text-gray-600">
                Visualize e gerencie os problemas e sugestões reportados pelos usuários.
            </p>
            <div className="bg-white rounded-lg shadow p-6">
                <FeedbackList initialFeedbacks={feedbacks || []} />
            </div>
        </div>
    );
}