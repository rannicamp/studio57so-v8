"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationManager from '@/components/notificacao/NotificationManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faBullhorn, faMobileAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function PaginaTesteNotificacao() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Função genérica para enviar
  const dispararNotificacao = async (tipo) => {
    if (!user) return toast.error("Faça login primeiro!");
    setLoading(true);
    setStatus('Enviando solicitação...');

    try {
      // Configura o payload dependendo do botão clicado
      const payload = {
        title: tipo === 'todos' ? "📢 Aviso Geral" : "🔔 Teste Pessoal",
        message: tipo === 'todos' 
          ? `Teste para toda a equipe às ${new Date().toLocaleTimeString()}!` 
          : `Teste exclusivo para você às ${new Date().toLocaleTimeString()}!`,
        url: "/teste-notificacao",
        // SEGREDO AQUI:
        // Se for 'todos', mandamos APENAS organizacaoId (e userId null)
        // Se for 'pessoal', mandamos userId
        userId: tipo === 'todos' ? null : user.id,
        organizacaoId: user.organizacao_id
      };

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`✅ Sucesso! Enviado para ${data.count} dispositivo(s).`);
        toast.success(tipo === 'todos' ? "Enviado para todos!" : "Enviado para seus dispositivos!");
      } else {
        setStatus(`❌ Erro: ${data.message || 'Falha no envio'}`);
        toast.error("Erro ao enviar.");
      }
    } catch (error) {
      console.error(error);
      setStatus('❌ Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">🧪 Laboratório de Notificações</h1>
      
      {/* Bloco 1: Status */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="font-semibold text-lg border-b pb-2">1. Status Deste Dispositivo</h2>
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
          <span>Sua inscrição atual:</span>
          <NotificationManager />
        </div>
        <div className="text-xs text-gray-500 mt-2">
          <strong>Seu ID de Usuário:</strong> {user?.id || 'Não logado'} <br/>
          <strong>Sua Organização:</strong> {user?.organizacao_id || 'N/A'}
        </div>
      </div>

      {/* Bloco 2: Testes */}
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-6">
        <h2 className="font-semibold text-lg text-blue-900 border-b border-blue-200 pb-2">2. Disparar Testes</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Botão A: Teste Pessoal */}
          <button
            onClick={() => dispararNotificacao('pessoal')}
            disabled={loading}
            className="py-4 px-4 bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 rounded-lg font-bold shadow-sm transition-all active:scale-95 flex flex-col items-center gap-2"
          >
            <FontAwesomeIcon icon={faMobileAlt} size="lg" />
            <span>Testar SÓ COMIGO</span>
            <span className="text-xs font-normal opacity-70">(Apenas dispositivos logados nesta conta)</span>
          </button>

          {/* Botão B: Teste Geral (O QUE VAI FUNCIONAR PRO CELULAR) */}
          <button
            onClick={() => dispararNotificacao('todos')}
            disabled={loading}
            className="py-4 px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-lg transition-all active:scale-95 flex flex-col items-center gap-2"
          >
            <FontAwesomeIcon icon={faBullhorn} size="lg" />
            <span>Testar TODA EQUIPE</span>
            <span className="text-xs font-normal opacity-80">(Inclui seu celular com outra conta)</span>
          </button>
        </div>

        {status && (
          <div className={`p-4 rounded-lg text-center font-mono text-sm font-bold border ${status.includes('Sucesso') ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
            {status}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-center">
        Dica: Para o celular vibrar, bloqueie a tela logo após clicar no botão.
      </div>
    </div>
  );
}