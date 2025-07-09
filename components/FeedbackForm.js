"use client";

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

export default function FeedbackForm() {
    const { user } = useAuth();
    const [pagina, setPagina] = useState('');
    const [descricao, setDescricao] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            setMessage('Você precisa estar logado para enviar feedback.');
            return;
        }
        setLoading(true);
        setMessage('Enviando seu feedback...');

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario_id: user.id,
                    pagina,
                    descricao
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Ocorreu um erro.');
            }

            setMessage('Feedback enviado com sucesso! Obrigado por ajudar a melhorar o sistema.');
            setPagina('');
            setDescricao('');

        } catch (error) {
            setMessage(`Erro ao enviar feedback: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
            {message && (
                <p className={`text-center p-3 rounded-md text-sm font-semibold ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </p>
            )}
            <div>
                <label htmlFor="pagina" className="block text-sm font-medium text-gray-700">Página ou Funcionalidade</label>
                <input
                    type="text"
                    id="pagina"
                    value={pagina}
                    onChange={(e) => setPagina(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-md"
                    placeholder="Ex: Tela de Funcionários, Cadastro de Contato"
                />
            </div>
            <div>
                <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">Descrição do Problema ou Sugestão *</label>
                <textarea
                    id="descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                    rows="6"
                    className="mt-1 w-full p-2 border rounded-md"
                    placeholder="Por favor, descreva detalhadamente o que aconteceu ou qual é a sua sugestão de melhoria."
                />
            </div>
            <div className="text-right">
                <button
                    type="submit"
                    disabled={loading || !descricao}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                    {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                    {loading ? 'Enviando...' : 'Enviar Feedback'}
                </button>
            </div>
        </form>
    );
}