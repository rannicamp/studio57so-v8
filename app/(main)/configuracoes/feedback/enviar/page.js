import FeedbackForm from '@/components/FeedbackForm';
import Link from 'next/link';

export default function EnviarFeedbackPage() {
    return (
        <div className="space-y-6">
             <Link href="/configuracoes/feedback" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Central de Feedback
            </Link>
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">Enviar Feedback</h1>
                <p className="text-gray-600 mt-2">
                    Encontrou um problema ou tem uma sugestão? Use o formulário abaixo para nos avisar.
                </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md">
                <FeedbackForm />
            </div>
        </div>
    );
}