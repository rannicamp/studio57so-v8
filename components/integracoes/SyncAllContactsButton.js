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
      // 1. Pega todos os contatos da organização
      const { data: contatos, error } = await supabase
        .from('contatos')
        .select('id, nome, razao_social')
        .eq('organizacao_id', organizacaoId);

      if (error) throw error;

      if (!contatos || contatos.length === 0) {
        alert('Nenhum contato encontrado na base de dados.');
        setLoading(false);
        return;
      }

      setProgress({ total: contatos.length, current: 0 });
      setStatusText('Sincronizando...');

      // 2. Loop para sincronizar um a um (para evitar Rate Limits)
      let sucesso = 0;
      let falhas = 0;

      for (let i = 0; i < contatos.length; i++) {
        const contato = contatos[i];
        try {
          const res = await fetch('/api/google/sync-contatos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contato_id: contato.id, organizacao_id: organizacaoId }),
          });

          if (res.ok) {
            sucesso++;
          } else {
            falhas++;
          }
        } catch (err) {
          console.error(`Erro ao sincronizar contato ${contato.id}:`, err);
          falhas++;
        }

        setProgress({ total: contatos.length, current: i + 1 });
        // Pequena pausa para não afogar a API do Google
        await new Promise(r => setTimeout(r, 500));
      }

      setStatusText('Concluído!');
      alert(`Sincronização finalizada!\nSucesso: ${sucesso}\nFalhas: ${falhas}`);

    } catch (error) {
      console.error('Erro geral no SyncAll:', error);
      alert('Erro ao buscar contatos: ' + error.message);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress({ total: 0, current: 0 });
        setStatusText('');
      }, 3000);
    }
  };

  return (
    <div className="w-full">
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
