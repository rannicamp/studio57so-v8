// app/teste-notificacao/page.js
"use client";

import { useState } from 'react';
import { notificarGrupo } from '@/utils/notificacoes'; // Importamos a função mágica
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faMoneyBillWave, faHardHat, faBell, faExclamationTriangle, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function TesteNotificacaoPage() {
  const [loading, setLoading] = useState(false);
  const [permissao, setPermissao] = useState('financeiro'); // Quem vai receber?
  const [tipo, setTipo] = useState('sistema'); // Qual o ícone?
  const [titulo, setTitulo] = useState('Teste do Sistema');
  const [mensagem, setMensagem] = useState('Essa é uma notificação de teste enviada pelo painel administrativo.');

  const handleEnviar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Chama a função do servidor que busca os usuários e dispara
      const resultado = await notificarGrupo({
        permissao: permissao, // Ex: 'financeiro' -> busca quem tem permissão de ver financeiro
        titulo: titulo,
        mensagem: mensagem,
        link: '/painel', // Link para onde o usuário vai ao clicar
        tipo: tipo // Define a cor e o ícone
      });

      if (resultado.sucesso) {
        toast.success(`Sucesso! Enviado para ${resultado.count} usuários.`);
      } else {
        toast.error(`Erro: ${resultado.erro}`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro inesperado ao enviar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-gray-100 p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">🧪 Laboratório de Notificações</h1>
          <p className="text-gray-500 text-sm mt-2">Teste o disparo em massa por permissão.</p>
        </div>

        <form onSubmit={handleEnviar} className="space-y-6">
          
          {/* 1. Seleção do Grupo Alvo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Quem deve receber?</label>
            <select 
              value={permissao} 
              onChange={(e) => setPermissao(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="financeiro">👥 Time Financeiro (Ver Financeiro)</option>
              <option value="obras">👷 Time de Obras (Ver Obras)</option>
              <option value="config_menu">⚙️ Administradores (Config Menu)</option>
              <option value="atividades">📅 Gestão de Atividades</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">O sistema buscará automaticamente todos os usuários com essa permissão.</p>
          </div>

          {/* 2. Seleção do Estilo Visual */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Estilo da Notificação</label>
            <div className="grid grid-cols-3 gap-2">
              <TipoButton atual={tipo} set={setTipo} valor="financeiro" icon={faMoneyBillWave} label="Financeiro" color="bg-green-100 text-green-700" />
              <TipoButton atual={tipo} set={setTipo} valor="obras" icon={faHardHat} label="Obras" color="bg-orange-100 text-orange-700" />
              <TipoButton atual={tipo} set={setTipo} valor="alerta" icon={faExclamationTriangle} label="Alerta" color="bg-yellow-100 text-yellow-700" />
              <TipoButton atual={tipo} set={setTipo} valor="sucesso" icon={faCheckCircle} label="Sucesso" color="bg-teal-100 text-teal-700" />
              <TipoButton atual={tipo} set={setTipo} valor="sistema" icon={faBell} label="Padrão" color="bg-blue-100 text-blue-700" />
            </div>
          </div>

          {/* 3. Conteúdo */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">Título</label>
              <input 
                type="text" 
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full p-2 border-b-2 border-gray-200 focus:border-blue-500 outline-none transition-colors"
                placeholder="Ex: Pagamento Aprovado"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">Mensagem</label>
              <textarea 
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="w-full p-2 border-b-2 border-gray-200 focus:border-blue-500 outline-none transition-colors h-24 resize-none"
                placeholder="Digite a mensagem que aparecerá no card..."
                required
              />
            </div>
          </div>

          {/* Botão de Ação */}
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]
              ${loading ? 'bg-gray-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {loading ? (
              <span>Enviando... 🚀</span>
            ) : (
              <>
                <FontAwesomeIcon icon={faPaperPlane} />
                Disparar Notificação
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}

// Pequeno componente auxiliar para os botões de tipo
function TipoButton({ atual, set, valor, icon, label, color }) {
  const isSelected = atual === valor;
  return (
    <button
      type="button"
      onClick={() => set(valor)}
      className={`
        flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-medium
        ${isSelected ? `${color} border-current ring-2 ring-offset-1 ring-blue-100` : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}
      `}
    >
      <FontAwesomeIcon icon={icon} className="mb-1 text-base" />
      {label}
    </button>
  );
}