'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function SyncAllContactsButton({ organizacaoId }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ total: 0, current: 0 });
  const [statusText, setStatusText] = useState('');

  const handleSyncAll = async () => {
    if (!confirm('Deseja sincronizar TODOS os contatos da base com a sua agenda do Google? Isso pode demorar alguns minutos.')) return;

    setLoading(true);
    setStatusText('Buscando contatos...');
    const supabase = createClient();

    try {
      // 1. Pega todos os contatos da organização (com paginação para driblar o limite de 1000 do Supabase)
      let allContatos = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('contatos')
          .select('id, nome, razao_social')
          .eq('organizacao_id', organizacaoId)
          .range(start, start + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allContatos = [...allContatos, ...data];
          start += pageSize;
          if (data.length < pageSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      
      const contatos = allContatos;

      if (!contatos || contatos.length === 0) {
        alert('Nenhum contato encontrado na base de dados.');
        setLoading(false);
        return;
      }

      setStatusText('Enviando para a fila de processamento...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const contatosIds = contatos.map(c => c.id);

      // Envia os IDs para a nossa rota de fila (Background Queue)
      const res = await fetch('/api/google/queue-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contatosIds, 
          organizacao_id: organizacaoId,
          user_id: user.id
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Falha ao colocar na fila');
      }

      setStatusText('Fila Iniciada!');
      alert(`Sucesso! ${contatos.length} contatos foram colocados na Fila de Sincronização em Segundo Plano.\n\nO servidor vai enviar 20 contatos por minuto para o Google. Você já pode fechar esta tela e continuar trabalhando livremente!`);

    } catch (error) {
      console.error('Erro geral no SyncAll:', error);
      alert('Erro ao enviar para a fila: ' + error.message);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setStatusText('');
      }, 3000);
    }
  };

  const handleCancelSync = async () => {
    if (!confirm('Deseja realmente cancelar a sincronização em andamento? Isso removerá todos os contatos da fila de espera.')) return;

    setLoading(true);
    setStatusText('Cancelando fila...');

    try {
      const res = await fetch('/api/google/cancel-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizacao_id: organizacaoId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar');

      alert(`Cancelamento concluído! ${data.count} contatos foram removidos da fila de espera.`);
    } catch (error) {
      console.error('Erro ao cancelar sync:', error);
      alert('Erro ao cancelar: ' + error.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  return (
    <div className="w-full space-y-3">
      <button
        onClick={handleSyncAll}
        disabled={loading}
        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
          loading ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-900 hover:bg-black text-white shadow-md'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{statusText} {progress.total > 0 && `(${progress.current}/${progress.total})`}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Sincronizar Todos os Contatos
          </>
        )}
      </button>

      <button
        onClick={handleCancelSync}
        disabled={loading}
        className={`w-full py-2 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
          loading ? 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-50' : 'text-red-600 bg-red-50 hover:bg-red-100'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        Parar Sincronização em Lote
      </button>

      {/* Barra de progresso */}
      {loading && progress.total > 0 && (
        <div className="mt-3 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300" 
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}
