// app/(main)/contatos/editar/[id]/page.js
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../../utils/supabase/client';
import ContatoForm from '../../../../../components/ContatoForm';
import { useLayout } from '../../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function EditarContatoPage() {
    const { setPageTitle } = useLayout();
    const router = useRouter();
    const { id } = useParams();
    
    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const supabase = createClient();

    const getContato = useCallback(async (contatoId) => {
        setLoading(true);
        setError('');
        try {
            // 1. Buscar os dados principais do contato
            const { data: contatoData, error: contatoError } = await supabase
                .from('contatos')
                .select(`*`) // Seleciona apenas as colunas da tabela contatos
                .eq('id', contatoId)
                .single();

            if (contatoError) {
                console.error("Erro detalhado do Supabase ao buscar contato principal:", contatoError); 
                if (contatoError.code === 'PGRST116') {
                    setError('Contato não encontrado.');
                } else {
                    setError(`Ocorreu um erro ao carregar os dados do contato: ${contatoError.message || 'Erro desconhecido.'}`);
                }
                setInitialData(null);
                return; // Sai da função se o contato principal não for encontrado
            }

            // 2. Buscar os telefones do contato separadamente
            const { data: telefonesData, error: telefonesError } = await supabase
                .from('telefones')
                .select('*')
                .eq('contato_id', contatoId);

            if (telefonesError) {
                console.error("Erro ao buscar telefones do contato:", telefonesError);
                // Continua mesmo com erro, pois o telefone pode ser opcional ou o erro pode ser ignorado
            }

            // 3. Buscar os emails do contato separadamente
            const { data: emailsData, error: emailsError } = await supabase
                .from('emails')
                .select('*')
                .eq('contato_id', contatoId);

            if (emailsError) {
                console.error("Erro ao buscar emails do contato:", emailsError);
                // Continua mesmo com erro, pois o email pode ser opcional ou o erro pode ser ignorado
            }

            // 4. Combinar todos os dados em um único objeto para passar ao ContatoForm
            setInitialData({
                ...contatoData,
                telefones: telefonesData || [], // Garante que seja um array, mesmo que vazio
                emails: emailsData || []      // Garante que seja um array, mesmo que vazio
            });

        } catch (err) {
            console.error('Erro inesperado ao buscar dados do contato:', err);
            setError('Ocorreu um erro ao carregar os dados do contato. (Erro interno)');
            setInitialData(null);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        setPageTitle('Editar Contato');
        if (id) {
            getContato(id);
        }
    }, [id, getContato, setPageTitle]);

    const handleSaveSuccess = () => {
        router.push('/contatos');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-lg">Carregando Contato...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <h2 className="text-2xl font-bold text-red-600">Erro</h2>
                <p className="mt-2 text-red-700">{error}</p>
                <button 
                    onClick={() => router.push('/contatos')}
                    className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700"
                >
                    Voltar para Contatos
                </button>
            </div>
        );
    }

    return (
        <div>
            {initialData && <ContatoForm contactToEdit={initialData} onSaveSuccess={handleSaveSuccess} onClose={handleSaveSuccess} />}
            {!initialData && !loading && !error && (
                <div className="text-center p-10 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h2 className="text-2xl font-bold text-yellow-600">Nenhum contato para editar.</h2>
                    <button 
                        onClick={() => router.push('/contatos')}
                        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700"
                    >
                        Voltar para Contatos
                    </button>
                </div>
            )}
        </div>
    );
}
