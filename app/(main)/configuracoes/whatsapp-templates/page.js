'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { Plus, RefreshCw, MessageSquare, AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import TemplateBuilderModal from '@/components/whatsapp/TemplateBuilderModal';
import Link from 'next/link';

export default function WhatsappTemplatesPage() {
  const { setPageTitle } = useLayout();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(null);

  useEffect(() => {
    setPageTitle('Modelos do WhatsApp');
  }, [setPageTitle]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates?all=true');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar templates');
      
      setTemplates(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao sincronizar modelos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (templateName) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR o modelo "${templateName}"? Ele deixará de funcionar imediatamente nas suas automações.`)) {
      return;
    }

    setDeletingTemplate(templateName);
    toast.loading(`Excluindo modelo ${templateName}...`, { id: 'delete-tpl' });

    try {
      const res = await fetch(`/api/whatsapp/templates?name=${templateName}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erro ao excluir modelo.');

      toast.success('Modelo excluído com sucesso!', { id: 'delete-tpl' });
      // Remover da lista localmente para ser mais rápido
      setTemplates(prev => prev.filter(t => t.name !== templateName));
    } catch (err) {
      console.error(err);
      toast.error(err.message, { id: 'delete-tpl' });
    } finally {
      setDeletingTemplate(null);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'APPROVED':
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200"><CheckCircle size={14} /> Aprovado</span>;
      case 'PENDING':
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200"><Clock size={14} /> Em Análise</span>;
      case 'REJECTED':
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-200"><AlertCircle size={14} /> Rejeitado</span>;
      default:
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="w-full p-4 md:p-8 animate-in fade-in duration-500">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Modelos de Mensagem</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            Gerencie os templates aprovados pela Meta para disparo no WhatsApp.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={fetchTemplates}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Sincronizar
          </button>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Criar Modelo
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full">
        {loading && templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-gray-400">
            <RefreshCw className="animate-spin mb-4" size={32} />
            <p>Carregando modelos do WhatsApp...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center bg-white rounded-2xl shadow-sm border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6">
              <MessageSquare size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhum modelo encontrado</h3>
            <p className="text-gray-500 max-w-md mb-6">
              Você ainda não possui templates ou sua conta do WhatsApp não está vinculada. Modelos são obrigatórios para iniciar conversas com leads.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-[#25D366] font-bold hover:underline"
            >
              Criar meu primeiro modelo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Cabeçalho Flutuante */}
            <div className="hidden md:flex items-center px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              <div className="w-1/5">Nome do Modelo</div>
              <div className="w-28">Categoria</div>
              <div className="flex-1">Corpo (Preview)</div>
              <div className="w-36 text-center">Mensagens Entregues</div>
              <div className="w-32 text-center">Taxa de Leitura</div>
              <div className="w-32 text-center">Status</div>
              <div className="w-20 text-right">Ações</div>
            </div>

            {/* Linhas Flutuantes */}
            {templates.map((tpl) => {
              const bodyComponent = tpl.components?.find(c => c.type === 'BODY');
              const bodyText = bodyComponent?.text || '';
              
              return (
                <div key={tpl.name} className="flex flex-col md:flex-row items-start md:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all gap-4 md:gap-0">
                  
                  {/* Nome e Idioma */}
                  <div className="w-full md:w-1/5 pr-4">
                    <div className="font-bold text-gray-800 text-base truncate" title={tpl.name}>{tpl.name}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide">{tpl.language}</div>
                  </div>

                  {/* Categoria */}
                  <div className="w-full md:w-28 pr-2">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100/50 block w-fit">
                      {tpl.category === 'MARKETING' ? 'Marketing' : tpl.category === 'UTILITY' ? 'Utilidade' : tpl.category}
                    </span>
                  </div>

                  {/* Corpo / Preview */}
                  <div className="w-full md:flex-1 pr-4">
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 relative before:content-[''] before:absolute before:-left-1.5 before:top-4 before:w-3 before:h-3 before:bg-gray-50 before:border-l before:border-b before:border-gray-100 before:rotate-45">
                      <span className="line-clamp-2" title={bodyText}>
                        {bodyText || <span className="text-gray-400 italic">Sem corpo de texto</span>}
                      </span>
                    </div>
                  </div>

                  {/* Mensagens Entregues */}
                  <div className="w-full md:w-36 flex flex-col items-center justify-center mt-2 md:mt-0">
                    <span className="text-sm font-bold text-gray-700">{tpl.metrics?.delivered ?? 0}</span>
                    <span className="text-[10px] text-gray-400">de {tpl.metrics?.sent ?? 0} enviadas</span>
                  </div>

                  {/* Taxa de Leitura */}
                  <div className="w-full md:w-32 flex flex-col items-center justify-center mt-2 md:mt-0">
                    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-md border ${
                      (tpl.metrics?.read_rate ?? 0) >= 50 ? 'bg-green-50 text-green-700 border-green-200' :
                      (tpl.metrics?.read_rate ?? 0) >= 25 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      (tpl.metrics?.read_rate ?? 0) > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      'bg-gray-50 text-gray-400 border-gray-200'
                    }`}>
                      {tpl.metrics?.read_rate ?? 0}%
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">({tpl.metrics?.read ?? 0} visualizações)</span>
                  </div>

                  {/* Status */}
                  <div className="w-full md:w-32 flex md:justify-center mt-2 md:mt-0">
                    {getStatusBadge(tpl.status)}
                  </div>

                  {/* Ações */}
                  <div className="w-full md:w-20 flex justify-end mt-2 md:mt-0">
                    <button
                      onClick={() => handleDelete(tpl.name)}
                      disabled={deletingTemplate === tpl.name}
                      className="flex items-center justify-center p-2.5 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all disabled:opacity-50"
                      title="Excluir Modelo"
                    >
                      {deletingTemplate === tpl.name ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between items-center text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="font-medium">Mostrando {templates.length} modelos aprovados e em análise.</p>
        <Link href="/configuracoes/waba-saas" className="text-emerald-600 font-bold hover:underline flex items-center gap-1">
          Configurar Conexão do WhatsApp
        </Link>
      </div>

      {/* Modal Construtor */}
      <TemplateBuilderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchTemplates}
      />
    </div>
  );
}
