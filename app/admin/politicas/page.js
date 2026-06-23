"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCheckCircle, faFileAlt, faSpinner, faWarning, faUpload, faBookOpen } from '@fortawesome/free-solid-svg-icons';

export default function GestaoPoliticasPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [submitAction, setSubmitAction] = useState('publish');
  const [formData, setFormData] = useState({ tipo: 'termos_uso', versao: '', titulo: '', conteudo: '' });

  // Buscar políticas (Ordenadas das mais novas pras mais antigas, mostrando ativas no topo)
  const { data: politicas, isLoading } = useQuery({
    queryKey: ['politicas_admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('politicas_plataforma')
        .select('*')
        .order('is_active', { ascending: false })
        .order('data_publicacao', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (payload) => {
      const { publishNow, ...insertData } = payload;

      if (publishNow) {
        // Se for ativar uma nova política, as antigas do mesmo tipo perdem a coroa
        await supabase
          .from('politicas_plataforma')
          .update({ is_active: false })
          .eq('tipo', insertData.tipo);
      }

      // Insere a nova política com is_active: publishNow
      const { data, error } = await supabase
        .from('politicas_plataforma')
        .insert([{ ...insertData, is_active: publishNow }])
        .select()
        .single();

      if (error) throw error;
      return { data, publishNow };
    },
    onSuccess: ({ publishNow }) => {
      toast.success(publishNow ? "Nova política publicada e ativada com sucesso!" : "Rascunho salvo com sucesso!");
      queryClient.invalidateQueries(['politicas_admin']);
      setFormData({ tipo: 'termos_uso', versao: '', titulo: '', conteudo: '' });
      setIsCreating(false);
    },
    onError: (err) => {
      toast.error(`Falha ao salvar política: ${err.message}`);
    }
  });

  const publishDraftMutation = useMutation({
    mutationFn: async ({ id, tipo }) => {
      // Desativa todas do mesmo tipo
      await supabase.from('politicas_plataforma').update({ is_active: false }).eq('tipo', tipo);
      // Ativa a que foi clicada
      const { error } = await supabase.from('politicas_plataforma').update({ is_active: true }).eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Política Publicada! O bloqueio de sistema já está ativo para os clientes.");
      queryClient.invalidateQueries(['politicas_admin']);
    },
    onError: (err) => {
      toast.error(`Erro ao publicar rascunho: ${err.message}`);
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.versao.toLowerCase().includes('v')) {
      return toast.error("A versão deve seguir o padrão: v1.0, v2.1, etc.");
    }
    createPolicyMutation.mutate({ ...formData, publishNow: submitAction === 'publish' });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cabeçalho do Módulo Padrão Ouro */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">Compliance & Políticas</h2>
          </div>
          <p className="text-gray-500 font-medium">Gerencie os Termos de Uso e as Políticas de Privacidade gerais da plataforma.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {!isCreating && (
            <button 
              onClick={() => setIsCreating(true)} 
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 hover:shadow-lg transition-all flex items-center gap-2 shadow-sm shadow-blue-500/30"
            >
              <FontAwesomeIcon icon={faPlus} /> Nova Versão
            </button>
          )}
        </div>
      </div>

      {/* Criador de Documentos */}
      {isCreating && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Barra Viva Lateral - Azul Principal */}
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>

          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">
            Publicar Nova Versão Legal
          </h3>

          <form onSubmit={handleCreate} className="space-y-4 pl-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Tipo de Documento
                </label>
                <select
                  value={formData.tipo}
                  onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                >
                  <option value="termos_uso">Termos de Uso</option>
                  <option value="privacidade">Política de Privacidade</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Versão (ex: v1.0)
                </label>
                <input
                  required
                  type="text"
                  placeholder="v1.0"
                  value={formData.versao}
                  onChange={e => setFormData({ ...formData, versao: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Título Público
                </label>
                <input
                  required
                  type="text"
                  placeholder="Termos de Contratação do Studio 57"
                  value={formData.titulo}
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Conteúdo Legal (Regras)
              </label>
              <textarea
                required
                rows={12}
                placeholder="Digite todo o documento legal aqui. Use parágrafos e pontuações claras..."
                value={formData.conteudo}
                onChange={e => setFormData({ ...formData, conteudo: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400 resize-y"
              ></textarea>
            </div>

            {/* Aviso de Alerta - Amarelo */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
              <FontAwesomeIcon icon={faWarning} className="mt-0.5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-bold">Aviso de Impacto Legal:</p>
                <p className="mt-0.5 leading-relaxed">
                  Ao clicar em publicar, esta versão passará a ser a <strong className="font-bold">vigente</strong> e as anteriores serão revogadas. 
                  Todos os clientes que ainda não aceitaram esta nova versão terão o acesso travado na plataforma até realizarem o aceite dos novos termos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)} 
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              
              <button 
                type="submit" 
                onClick={() => setSubmitAction('draft')} 
                disabled={createPolicyMutation.isPending} 
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
              >
                {createPolicyMutation.isPending && submitAction === 'draft' ? (
                  <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
                ) : null}
                Salvar Rascunho
              </button>

              <button 
                type="submit" 
                onClick={() => setSubmitAction('publish')} 
                disabled={createPolicyMutation.isPending} 
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
              >
                {createPolicyMutation.isPending && submitAction === 'publish' ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : null}
                Publicar Edital / Política
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Listagem do Histórico */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wider">Histórico de Políticas</h3>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-2xl" />
            <span className="text-sm font-medium">Buscando histórico...</span>
          </div>
        ) : politicas?.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400 shadow-sm border border-blue-100">
              <FontAwesomeIcon icon={faFileAlt} className="text-2xl" />
            </div>
            <p className="text-gray-800 font-bold">Nenhum documento legal encontrado.</p>
            <p className="text-gray-500 text-sm mt-1">Clique em "Nova Versão" para começar.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {politicas.map((pol) => (
              <div key={pol.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-blue-50/20 transition-all group">
                <div>
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h4 className="font-bold text-gray-800 text-base">{pol.titulo || 'Termos de Uso'}</h4>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded border border-gray-200 font-mono font-bold">
                      {pol.versao}
                    </span>
                    {pol.is_active ? (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-green-50 text-green-700 border border-green-200 uppercase flex items-center gap-1">
                        <FontAwesomeIcon icon={faCheckCircle} /> Vigente
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-gray-50 text-gray-400 border border-gray-200 uppercase">
                        Inativo / Rascunho
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 font-semibold mt-1">
                    <span>Tipo: <strong className="text-gray-700 uppercase font-bold">{pol.tipo === 'termos_uso' ? 'Termos de Uso' : 'Política de Privacidade'}</strong></span>
                    <span className="text-gray-300">|</span>
                    <span>Publicado em: {new Date(pol.data_publicacao).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!pol.is_active && (
                    <button
                      onClick={() => publishDraftMutation.mutate({ id: pol.id, tipo: pol.tipo })}
                      disabled={publishDraftMutation.isPending}
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-bold px-3 py-1.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5"
                      title="Ativar esta versão e bloquear os clientes que ainda não a assinaram."
                    >
                      {publishDraftMutation.isPending ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faUpload} size="sm" />
                          Publicar
                        </>
                      )}
                    </button>
                  )}
                  
                  <button className="text-gray-500 hover:text-gray-700 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faBookOpen} size="sm" />
                    Visualizar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
