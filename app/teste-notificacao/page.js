"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationManager from '@/components/notificacao/NotificationManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function PaginaTesteNotificacao() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const enviarTeste = async () => {
    if (!user) return toast.error("Faça login primeiro!");
    setLoading(true);
    setStatus('Enviando solicitação...');

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          organizacaoId: user.organizacao_id,
          title: "🔔 Teste Manual",
          message: `Testando vibração às ${new Date().toLocaleTimeString()}!`,
          url: "/teste-notificacao"
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`✅ Sucesso! Enviado para ${data.count || 0} dispositivos.`);
        toast.success("Notificação enviada! Verifique o celular.");
      } else {
        setStatus(`❌ Erro: ${data.error || data.message}`);
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
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="font-semibold text-lg border-b pb-2">1. Status do Dispositivo</h2>
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
          <span>Sua inscrição atual:</span>
          <NotificationManager />
        </div>
        <p className="text-sm text-gray-500">
          {/* AQUI ESTAVA O ERRO: Trocamos as aspas duplas por aspas simples ou código HTML */}
          * Se não estiver &quot;Ativo&quot;, clique no botão acima primeiro.
        </p>
      </div>

      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
        <h2 className="font-semibold text-lg text-blue-900 border-b border-blue-200 pb-2">2. Área de Teste</h2>
        <p className="text-blue-800">
          Aperte o botão abaixo, bloqueie a tela do celular e espere vibrar.
        </p>
        
        <button
          onClick={enviarTeste}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          {loading ? (
            "Enviando..."
          ) : (
            <>
              <FontAwesomeIcon icon={faPaperPlane} />
              DISPARAR NOTIFICAÇÃO AGORA
            </>
          )}
        </button>

        {status && (
          <div className={`p-3 rounded text-center font-mono text-sm ${status.includes('Sucesso') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {status}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-center">
        Dica: No Android, certifique-se que o app está instalado e não apenas aberto no Chrome.
      </div>
    </div>
  );
}