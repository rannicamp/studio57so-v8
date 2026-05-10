'use client';

import { useState } from 'react';

export default function GoogleCalendarButton({ isConnected, email, tipo = 'agenda', title = 'Google Agenda', description = '', children }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    setLoading(true);
    // Redireciona para a nossa rota de Auth passando o tipo de conexão
    window.location.href = `/api/google/auth?tipo=${tipo}`;
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar esta integração do Google?')) return;
    setLoading(true);
    try {
      // Modificamos a rota para suportar o tipo no backend se necessário, ou enviamos na query
      const res = await fetch(`/api/google/disconnect?tipo=${tipo}`, { method: 'POST' });
      if (res.ok) {
        window.location.reload(); // Recarrega para mostrar como desconectado
      } else {
        alert('Erro ao tentar desconectar.');
      }
    } catch (err) {
      alert('Erro ao tentar desconectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`border rounded-2xl p-8 shadow-sm flex flex-col justify-between transition-all duration-300 ${isConnected ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-md'}`}>
      <div>
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isConnected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
            <p className="text-sm text-gray-500">{isConnected ? 'Conectado' : 'Sincronização'}</p>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-auto pt-6 border-t border-gray-100">
        {isConnected ? (
          <button 
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full py-3 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors"
          >
            {loading ? 'Aguarde...' : 'Desconectar'}
          </button>
        ) : (
          <button 
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? 'Conectando...' : 'Conectar Conta'}
          </button>
        )}
      </div>

      {/* Área para botões extras, como o Sync All */}
      {children && (
        <div className="mt-4 pt-4 border-t border-gray-100 border-dashed">
          {children}
        </div>
      )}
    </div>
  );
}
