// components/FeedbackForm.js

"use client";

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function FeedbackForm() {
    const { userData } = useAuth(); // Usando userData para ter acesso à organização
    const [pagina, setPagina] = useState('');
    const [descricao, setDescricao] = useState('');

    const { mutate: sendFeedback, isPending } = useMutation({
        mutationFn: async (feedbackData) => {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedbackData)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Ocorreu um erro ao enviar o feedback.');
            }
            return result;
        },
        onSuccess: () => {
            toast.success('Feedback enviado com sucesso! Obrigado por ajudar a melhorar o sistema.');
            setPagina('');
            setDescricao('');
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userData) {
            toast.error('Você precisa estar logado para enviar feedback.');
            return;
        }

        const feedbackData = {
            usuario_id: userData.id,
            organizacao_id: userData.organizacao_id, // Adicionando o carimbo da organização
            pagina,
            descricao
        };
        
        sendFeedback(feedbackData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
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
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isPending || !descricao}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                    {isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                    {isPending ? 'Enviando...' : 'Enviar Feedback'}
                </button>
            </div>
        </form>
    );
}

// --------------------------------------------------------------------------------
// RESUMO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente renderiza um formulário para que os usuários possam enviar
// feedbacks, sugestões ou relatar problemas. Ele captura a página, a descrição
// e, usando o hook `useAuth`, associa o feedback ao usuário e à sua organização.
// A lógica de envio foi refatorada para usar `useMutation` e `toast` para uma
// experiência de usuário mais moderna e reativa.
// --------------------------------------------------------------------------------