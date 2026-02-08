//components/PoliticasModal.js
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function PoliticasModal() {
  const { user, userData, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [showModal, setShowModal] = useState(false);
  const [hasRejected, setHasRejected] = useState(false);

  useEffect(() => {
    if (!authLoading && userData && userData.aceitou_termos === false) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [user, userData, authLoading]);

  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { error } = await supabase
        .from('usuarios')
        .update({
          aceitou_termos: true,
          data_aceite_termos: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      setShowModal(false);
      window.location.reload();
    },
  });

  const handleAccept = () => {
    toast.promise(acceptTermsMutation.mutateAsync(), {
      loading: 'Salvando sua aceitação...',
      success: 'Termos aceitos com sucesso! Atualizando...',
      error: (err) => `Erro ao salvar: ${err.message}`,
    });
  };

  const handleReject = () => {
    setHasRejected(true);
  };

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] flex flex-col">
        
        {hasRejected && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <div className="flex">
              <div className="py-1"><FontAwesomeIcon icon={faExclamationTriangle} className="h-6 w-6 text-red-500 mr-4" /></div>
              <div>
                <p className="font-bold">Acesso Bloqueado</p>
                <p className="text-sm">Para utilizar o sistema, é necessário ler e aceitar os Termos de Uso e a Política de Privacidade.</p>
              </div>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 text-center mb-4 flex-shrink-0">Políticas de Uso e Privacidade</h1>
        
        <div className="prose max-w-none overflow-y-auto pr-4 border-y py-4 max-h-[65vh]">
          
          <h2>Termos de Uso do Sistema Studio 57</h2>
          <p className="text-sm">Última atualização: 13 de setembro de 2025</p>
          <p>Bem-vindo ao Sistema de Gestão Integrada do Studio 57. Ao acessar e utilizar esta plataforma, você concorda em cumprir e estar sujeito aos seguintes termos e condições de uso.</p>
          
          <h3>1. Contas de Usuário</h3>
          <p>O acesso ao sistema é restrito a usuários autorizados. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem em sua conta.</p>

          <h3>2. Uso Aceitável</h3>
          <p>Você concorda em usar o sistema apenas para fins comerciais legítimos do Studio 57. É estritamente proibido inserir informações falsas, realizar upload de arquivos maliciosos ou tentar obter acesso não autorizado.</p>

          <h3>3. Confidencialidade</h3>
          <p>Todas as informações contidas neste sistema são consideradas confidenciais e propriedade do Studio 57. A divulgação não autorizada é estritamente proibida.</p>
          
          <h3>4. Propriedade Intelectual</h3>
          <p>O software, design, layout e todos os componentes do sistema são propriedade intelectual do Studio 57 e protegidos por leis de direitos autorais.</p>

          <h3>5. Limitação de Responsabilidade</h3>
          <p>O sistema é fornecido &apos;como está&apos;. O Studio 57 não se responsabiliza por perdas de dados ou danos resultantes do uso (ou da incapacidade de uso) da plataforma.</p>

          <hr />

          <h2>Política de Privacidade</h2>
          <p className="text-sm">Última atualização: 13 de setembro de 2025</p>

          <h3>1. Coleta de Dados</h3>
          <p>Coletamos informações que você nos fornece diretamente, incluindo dados de identificação, financeiros, profissionais e conteúdo gerado pelo usuário (uploads, mensagens).</p>

          <h3>2. Compartilhamento com Terceiros e IA</h3>
          <p>Para fornecer nossos serviços, compartilhamos dados com parceiros como Supabase (armazenamento), Google (IA Stella e Calendar) e Meta (WhatsApp).</p>
        </div>
        
        <div className="mt-auto pt-6 flex flex-col md:flex-row items-center justify-center gap-4 flex-shrink-0">
            {!hasRejected && (
                <button
                    onClick={handleReject}
                    disabled={acceptTermsMutation.isPending}
                    className="w-full md:w-auto bg-gray-200 text-gray-800 font-bold py-3 px-10 rounded-md hover:bg-gray-300 transition-colors"
                >
                    Não aceito
                </button>
            )}

            <button
                onClick={handleAccept}
                disabled={acceptTermsMutation.isPending}
                className="w-full md:w-auto bg-green-600 text-white font-bold py-3 px-10 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
            >
                {acceptTermsMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
                {acceptTermsMutation.isPending ? 'Salvando...' : 'Li e aceito os termos'}
            </button>
        </div>
      </div>
    </div>
  );
}