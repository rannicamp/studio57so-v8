// Local do Arquivo: app/teste-notificacao/page.js
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { enviarNotificacao, notificarGrupo } from '@/utils/notificacoes';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPaperPlane, 
    faUser, 
    faUsers, 
    faCheckCircle, 
    faExclamationTriangle,
    faMoneyBillWave, 
    faHardHat,
    faSearch,
    faMobileAlt,
    faVial
} from '@fortawesome/free-solid-svg-icons';

export default function TesteNotificacaoPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    
    // Estado do formulário
    const [tipo, setTipo] = useState('sistema');
    const [titulo, setTitulo] = useState('Teste de Aviso');
    const [mensagem, setMensagem] = useState('Esta é uma mensagem de teste do sistema.');
    const [link, setLink] = useState('/painel');
    const [modo, setModo] = useState('mim'); // 'mim', 'grupo'
    const [permissaoAlvo, setPermissaoAlvo] = useState('admin');
    
    // Estado para mostrar quem vai receber
    const [destinatarios, setDestinatarios] = useState([]);
    const [buscandoDestinatarios, setBuscandoDestinatarios] = useState(false);

    // Efeito para buscar destinatários quando muda a permissão
    useEffect(() => {
        if (modo === 'grupo') {
            checkDestinatarios();
        } else {
            setDestinatarios([]);
        }
    }, [modo, permissaoAlvo]);

    const checkDestinatarios = async () => {
        setBuscandoDestinatarios(true);
        try {
            const res = await fetch('/api/admin/check-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissao: permissaoAlvo })
            });
            const data = await res.json();
            setDestinatarios(data.users || []);
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
            toast.error("Erro ao buscar lista de usuários.");
        } finally {
            setBuscandoDestinatarios(false);
        }
    };

    const handleEnviar = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!user) {
                toast.error("Você precisa estar logado!");
                return;
            }

            let resultado;

            if (modo === 'mim') {
                resultado = await enviarNotificacao({
                    userId: user.id,
                    titulo,
                    mensagem,
                    link,
                    tipo
                });
            } else {
                resultado = await notificarGrupo({
                    permissao: permissaoAlvo,
                    titulo: `[GRUPO] ${titulo}`,
                    mensagem,
                    link,
                    tipo
                });
            }

            if (resultado.sucesso) {
                toast.success("Notificação enviada!", {
                    description: modo === 'grupo' 
                        ? `Enviada para ${resultado.count} usuários.` 
                        : "Verifique seu sininho no topo."
                });
            } else {
                throw new Error(resultado.erro || "Erro desconhecido");
            }

        } catch (error) {
            console.error(error);
            toast.error("Falha ao enviar", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Coluna da Esquerda: Formulário */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                <FontAwesomeIcon icon={faPaperPlane} />
                                Laboratório de Notificações
                            </h1>
                            <p className="text-blue-100 mt-2 text-sm">
                                Configure e dispare alertas do sistema para testes.
                            </p>
                        </div>

                        <form onSubmit={handleEnviar} className="p-6 space-y-6">
                            
                            {/* Seleção de Modo */}
                            <div className="grid grid-cols-2 gap-4 p-1 bg-gray-100 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setModo('mim')}
                                    className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                        modo === 'mim' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={faUser} className="mr-2" /> Para Mim
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModo('grupo')}
                                    className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                        modo === 'grupo' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={faUsers} className="mr-2" /> Para Grupo
                                </button>
                            </div>

                            {/* Permissão (apenas se for Grupo) */}
                            {modo === 'grupo' && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Grupo Alvo (Permissão)</label>
                                    <select 
                                        value={permissaoAlvo}
                                        onChange={(e) => setPermissaoAlvo(e.target.value)}
                                        className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="admin">Administradores</option>
                                        <option value="comercial">Comercial / Vendas</option>
                                        <option value="financeiro">Financeiro</option>
                                        <option value="obras">Obras / Engenharia</option>
                                        <option value="rh">Recursos Humanos</option>
                                    </select>
                                </div>
                            )}

                            {/* Tipo de Notificação */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Estilo Visual</label>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { id: 'sistema', icon: faCheckCircle, label: 'Padrão', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                                        { id: 'sucesso', icon: faCheckCircle, label: 'Sucesso', color: 'bg-teal-100 text-teal-700 border-teal-200' },
                                        { id: 'erro', icon: faExclamationTriangle, label: 'Erro', color: 'bg-red-100 text-red-700 border-red-200' },
                                        { id: 'financeiro', icon: faMoneyBillWave, label: 'Financeiro', color: 'bg-green-100 text-green-700 border-green-200' },
                                        { id: 'obras', icon: faHardHat, label: 'Obras', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                                    ].map((style) => (
                                        <button
                                            key={style.id}
                                            type="button"
                                            onClick={() => setTipo(style.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                                tipo === style.id ? `ring-2 ring-offset-1 ring-blue-500 ${style.color}` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={style.icon} />
                                            {style.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Inputs de Texto */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Título</label>
                                    <input 
                                        type="text" 
                                        value={titulo}
                                        onChange={(e) => setTitulo(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Ex: Novo Contrato"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mensagem</label>
                                    <textarea 
                                        value={mensagem}
                                        onChange={(e) => setMensagem(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                        placeholder="Descreva o aviso aqui..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Link (Opcional)</label>
                                    <input 
                                        type="text" 
                                        value={link}
                                        onChange={(e) => setLink(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                        placeholder="/painel/financeiro"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {loading ? 'Enviando...' : (
                                    <>
                                        <FontAwesomeIcon icon={faPaperPlane} />
                                        Disparar Notificação
                                    </>
                                )}
                            </button>

                        </form>
                    </div>

                    {/* --- DIAGNÓSTICO MOBILE --- */}
                    <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <FontAwesomeIcon icon={faMobileAlt} className="text-gray-500" />
                            Diagnóstico Mobile (Teste Local)
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Use este botão para verificar se o seu celular consegue vibrar e exibir notificações. 
                            Este teste é <strong>local</strong> (não passa pelo servidor), servindo para isolar problemas de configuração do aparelho.
                        </p>
                        
                        <button
                            type="button"
                            onClick={async () => {
                                if (!("serviceWorker" in navigator)) {
                                    alert("❌ Seu navegador não suporta Service Worker.");
                                    return;
                                }
                                
                                // Solicita permissão se ainda não tiver
                                if (Notification.permission === 'default') {
                                    await Notification.requestPermission();
                                }

                                if (Notification.permission !== 'granted') {
                                    alert("❌ Permissão de notificação negada! Verifique as configurações do navegador.");
                                    return;
                                }

                                try {
                                    const reg = await navigator.serviceWorker.ready;
                                    await reg.showNotification("Teste de Vibração", {
                                        body: "Se você sentiu vibrar, o celular está pronto! 📳",
                                        icon: "/icons/icon-192x192.png",
                                        vibrate: [200, 100, 200, 100, 200] // Padrão de vibração
                                    });
                                    toast.success("Comando enviado para o celular!");
                                } catch (e) {
                                    alert("Erro ao tentar notificar: " + e.message);
                                }
                            }}
                            className="w-full bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            <FontAwesomeIcon icon={faVial} />
                            Testar Vibração Agora
                        </button>
                        <p className="text-[10px] text-gray-400 mt-2 italic text-center">
                            * Se não vibrar: verifique se o site está adicionado à tela de início (iOS) ou se o modo 'Não Perturbe' está desligado.
                        </p>
                    </div>
                </div>

                {/* Coluna da Direita: Lista de Quem Vai Receber */}
                <div className="md:col-span-1">
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sticky top-6">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                            Quem vai receber?
                        </h3>
                        
                        {modo === 'mim' ? (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700 flex flex-col items-center text-center gap-2">
                                <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold">
                                    EU
                                </div>
                                <div>
                                    <span className="font-bold block">Você mesmo!</span>
                                    <span className="text-xs opacity-80">(Apenas para teste)</span>
                                </div>
                            </div>
                        ) : buscandoDestinatarios ? (
                            <div className="text-center py-10 text-gray-400 animate-pulse flex flex-col items-center gap-2">
                                <FontAwesomeIcon icon={faSearch} spin />
                                <span className="text-sm">Buscando usuários...</span>
                            </div>
                        ) : destinatarios.length > 0 ? (
                            <div className="space-y-3">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    {destinatarios.length} Destinatário(s) encontrado(s)
                                </div>
                                <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                    {destinatarios.map((u) => (
                                        <div key={u.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors bg-gray-50/50">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex-shrink-0 flex items-center justify-center font-bold text-xs border border-blue-200">
                                                {u.nome ? u.nome.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">
                                                    {u.nome || 'Usuário sem nome'}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                                    {u.funcoes?.nome_funcao || 'Sem Cargo'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <p className="text-sm">Ninguém encontrado neste grupo.</p>
                                <p className="text-xs mt-2">Verifique as permissões em Configurações.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}