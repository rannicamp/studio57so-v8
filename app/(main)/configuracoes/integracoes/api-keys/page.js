'use client';

import { useEffect, useState } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faKey,
  faPlus,
  faTrashAlt,
  faCopy,
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
  faChevronLeft,
  faEye,
  faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ApiKeysPage() {
  const { setPageTitle } = useLayout();
  const queryClient = useQueryClient();
  const [nomeChave, setNomeChave] = useState('');
  const [expiracao, setExpiracao] = useState('0'); // 0 = Nunca expira
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null); // Armazena a chave gerada crua
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [showConfigLocal, setShowConfigLocal] = useState(false);

  useEffect(() => {
    setPageTitle('Integração de Agente IA (MCP)');
  }, [setPageTitle]);

  // 1. Query para buscar as chaves existentes (TanStack Query)
  const { data: keys = [], isLoading, isRefetching } = useQuery({
    queryKey: ['user_api_keys'],
    queryFn: async () => {
      const res = await fetch('/api/mcp/keys');
      if (!res.ok) throw new Error('Erro ao carregar chaves.');
      return res.json();
    },
    staleTime: 60000, // Cache de 1 minuto
  });

  // Carregamento Mágico: Exibir toast quando atualizado em background
  useEffect(() => {
    if (isRefetching && !isLoading) {
      toast.success('Lista de chaves atualizada!', { id: 'bg-update' });
    }
  }, [isRefetching, isLoading]);

  // 2. Mutation para criar uma chave
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/mcp/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao criar chave.');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setNewKeyData(data);
      setNomeChave('');
      setExpiracao('0');
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['user_api_keys'] });
      toast.success('Chave de API gerada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Falha ao gerar chave: ${error.message}`);
    }
  });

  // 3. Mutation para excluir/revogar uma chave
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/mcp/keys?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Erro ao revogar chave.');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_api_keys'] });
      toast.success('Chave revogada com sucesso.');
    },
    onError: (error) => {
      toast.error(`Falha ao revogar: ${error.message}`);
    }
  });

  const handleCreateKey = (e) => {
    e.preventDefault();
    if (!nomeChave.trim()) {
      toast.error('Dê um nome para a sua chave.');
      return;
    }
    createMutation.mutate({
      nome: nomeChave,
      expiracaoDias: expiracao === '0' ? null : Number(expiracao)
    });
  };

  const handleCopyKey = (keyText) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(true);
    toast.success('Chave de API copiada!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyConfig = (configJson) => {
    navigator.clipboard.writeText(configJson);
    setCopiedConfig(true);
    toast.success('Configuração JSON copiada!');
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  // Monta o JSON de exemplo de configuração do MCP (Ponte Stdio)
  const getMcpConfigString = (tokenValue) => {
    const host = typeof window !== 'undefined' ? window.location.origin : 'https://elo57.com.br';
    const finalUrl = showConfigLocal ? 'http://localhost:3000/api/mcp' : `${host}/api/mcp`;
    
    const configObj = {
      mcpServers: {
        "elo57": {
          "command": "node",
          "args": ["c:/Projetos/studio57so-v8/scripts/mcp-bridge.js"],
          "env": {
            "ELO57_API_KEY": tokenValue || "SUA_CHAVE_DE_API_AQUI",
            "ELO57_API_URL": finalUrl
          }
        }
      }
    };
    return JSON.stringify(configObj, null, 2);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Botão Voltar */}
      <div className="mb-6">
        <Link href="/configuracoes/integracoes" className="text-gray-500 hover:text-black transition-colors flex items-center gap-2 text-sm font-medium">
          <FontAwesomeIcon icon={faChevronLeft} />
          Voltar para Integrações
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FontAwesomeIcon icon={faKey} className="text-black" />
            API de Agente IA (MCP)
          </h1>
          <p className="text-gray-600 mt-2">
            Crie e gerencie chaves de acesso seguras para conectar seus agentes locais (como Antigravity, Cursor, Cline) aos dados da sua organização.
          </p>
        </div>
        <button
          onClick={() => {
            setNewKeyData(null);
            setShowCreateModal(true);
          }}
          className="bg-black hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-95 whitespace-nowrap self-start md:self-center"
        >
          <FontAwesomeIcon icon={faPlus} />
          Gerar Nova Chave
        </button>
      </div>

      {/* Alerta de chave recém-criada (CRÍTICO: Exibir apenas uma vez!) */}
      {newKeyData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 animate-in zoom-in-95 duration-200">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 shrink-0">
              <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-bold text-yellow-900">Guarde sua chave de API!</h3>
              <p className="text-yellow-800 text-sm mt-1">
                Por motivos de segurança, esta chave **nunca mais** será exibida após você fechar ou recarregar esta página. Copie-a agora e guarde em um local seguro.
              </p>
              
              <div className="mt-4 flex items-center gap-2 max-w-full">
                <code className="bg-white px-4 py-3 rounded-lg border border-yellow-300 font-mono text-sm break-all flex-grow block select-all">
                  {newKeyData.keyRaw}
                </code>
                <button
                  onClick={() => handleCopyKey(newKeyData.keyRaw)}
                  className="bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border border-yellow-300 p-3 rounded-lg flex items-center justify-center transition-colors focus:outline-none"
                  title="Copiar chave"
                >
                  <FontAwesomeIcon icon={copiedKey ? faCheck : faCopy} className={copiedKey ? "text-green-600" : ""} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel da Esquerda: Lista de chaves */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Suas Chaves Ativas</h2>

          {isLoading ? (
            <div className="py-12 text-center text-gray-500 text-sm">Carregando chaves...</div>
          ) : keys.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-xl">
              <FontAwesomeIcon icon={faKey} size="2x" className="text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Nenhuma chave de API criada ainda.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-black text-sm font-semibold hover:underline mt-2"
              >
                Gerar a primeira chave →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 rounded-lg">
                  <tr>
                    <th className="px-4 py-3">Identificador</th>
                    <th className="px-4 py-3">Prévia</th>
                    <th className="px-4 py-3">Criado em</th>
                    <th className="px-4 py-3">Último Uso</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {keys.map((key) => (
                    <tr key={key.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-gray-900">{key.nome}</td>
                      <td className="px-4 py-4 font-mono text-xs">{key.key_preview}</td>
                      <td className="px-4 py-4">
                        {new Date(key.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {key.last_used_at 
                          ? new Date(key.last_used_at).toLocaleString('pt-BR') 
                          : <span className="text-gray-400 italic">Nunca usado</span>
                        }
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja revogar a chave "${key.nome}"? Agentes conectados com ela perderão o acesso imediatamente.`)) {
                              deleteMutation.mutate(key.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors focus:outline-none"
                          title="Revogar chave de acesso"
                        >
                          <FontAwesomeIcon icon={faTrashAlt} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Painel da Direita: Instruções de Uso */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 flex flex-col h-full">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faInfoCircle} className="text-black" />
            Como Conectar o Agente
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            O Elo 57 implementa o **Model Context Protocol (MCP)** via Stdio Bridge local. Isso resolve timeouts de conexões persistentes em ambientes Serverless na nuvem.
          </p>

          <div className="border-t border-gray-200/50 pt-4 flex-grow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-700 uppercase">Configuração mcp_config.json</span>
              <button
                onClick={() => setShowConfigLocal(!showConfigLocal)}
                className="text-xs text-gray-500 hover:text-black flex items-center gap-1 font-medium bg-white px-2 py-1 rounded border border-gray-200"
              >
                <FontAwesomeIcon icon={showConfigLocal ? faEye : faEyeSlash} size="xs" />
                {showConfigLocal ? 'Usar URL Remota' : 'Usar Localhost'}
              </button>
            </div>
            
            <p className="text-gray-500 text-xs mb-2">
              Adicione o trecho abaixo no arquivo de configuração do seu agente (ex: `C:\Users\ranni\.gemini\antigravity\mcp_config.json` ou no Cursor):
            </p>

            <div className="relative group">
              <pre className="bg-gray-900 text-gray-100 text-[11px] font-mono p-4 rounded-lg overflow-x-auto max-h-60 border border-gray-800">
                {getMcpConfigString(newKeyData?.keyRaw)}
              </pre>
              <button
                onClick={() => handleCopyConfig(getMcpConfigString(newKeyData?.keyRaw))}
                className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-gray-300 p-1.5 rounded border border-gray-700 transition-colors focus:outline-none"
                title="Copiar JSON"
              >
                <FontAwesomeIcon icon={copiedConfig ? faCheck : faCopy} className={copiedConfig ? "text-green-400" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Criação de Chave */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-md w-full shadow-lg border border-gray-100 p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Gerar Nova Chave de API</h3>
            <p className="text-gray-500 text-sm mb-6">
              Dê um nome amigável para identificar onde esta chave será usada (ex: Antigravity Local).
            </p>

            <form onSubmit={handleCreateKey}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Nome da Chave
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Antigravity Ranniere"
                  value={nomeChave}
                  onChange={(e) => setNomeChave(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-colors"
                />
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Prazo de Expiração
                </label>
                <select
                  value={expiracao}
                  onChange={(e) => setExpiracao(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-colors"
                >
                  <option value="0">Nunca expira (Recomendado para IDEs)</option>
                  <option value="30">30 dias</option>
                  <option value="90">90 dias</option>
                  <option value="365">365 dias</option>
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm focus:outline-none"
                >
                  {createMutation.isPending ? 'Gerando...' : 'Gerar Chave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
