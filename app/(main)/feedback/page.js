import FeedbackForm from '@/components/FeedbackForm';

export default function FeedbackPage() {
    return (
        <div className="space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900">Central de Feedback</h1>
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