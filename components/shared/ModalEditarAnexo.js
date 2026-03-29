"use client";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faPen, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export default function ModalEditarAnexo({
  anexo,
  isOpen,
  onClose,
  onSuccess,
  tableName, // Ex: 'contratos_terceirizados_anexos' ou 'documentos_funcionarios'
  tiposDocumento = [],
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome_arquivo: "",
    descricao: "",
    tipo_documento_id: "",
    disponivel_corretor: false,
  });

  useEffect(() => {
    if (anexo && isOpen) {
      setFormData({
        nome_arquivo: anexo.nome_arquivo || "",
        descricao: anexo.descricao || "",
        tipo_documento_id: anexo.tipo_documento_id || "",
        disponivel_corretor: anexo.disponivel_corretor || false,
      });
    }
  }, [anexo, isOpen]);

  if (!isOpen || !anexo) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Determinar o campo correto de descrição/nome com base na tabela
      const updates = {};
      
      // Adaptador para bancos que usam "nome_documento" em vez de "nome_arquivo"
      if (tableName === "documentos_funcionarios") {
        updates.nome_documento = formData.nome_arquivo || formData.descricao;
        if (formData.tipo_documento_id) updates.tipo_documento_id = formData.tipo_documento_id;
      } else {
        updates.nome_arquivo = formData.nome_arquivo;
        updates.descricao = formData.descricao;
        if (formData.tipo_documento_id) updates.tipo_documento_id = formData.tipo_documento_id;
        if ('disponivel_corretor' in anexo) updates.disponivel_corretor = formData.disponivel_corretor;
      }

      const { error } = await supabase
        .from(tableName)
        .update(updates)
        .eq("id", anexo.id);

      if (error) throw error;

      toast.success("Anexo atualizado com sucesso!");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao atualizar anexo:", error);
      toast.error("Erro ao salvar as edições do anexo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <FontAwesomeIcon icon={faPen} className="text-orange-500" />
            Editar Metadados
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nome de Exibição do Arquivo
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.nome_arquivo}
              onChange={(e) =>
                setFormData({ ...formData, nome_arquivo: e.target.value })
              }
              placeholder="Ex: Contrato Assinado"
            />
          </div>

          {tableName !== "documentos_funcionarios" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Descrição Extra
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={2}
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                placeholder="Observações curtas..."
              />
            </div>
          )}

          {tiposDocumento.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Tipo / Tag de Documento
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.tipo_documento_id}
                onChange={(e) =>
                  setFormData({ ...formData, tipo_documento_id: e.target.value })
                }
              >
                <option value="">-- Sem Categoria --</option>
                {tiposDocumento.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.sigla ? `${t.sigla} - ` : ""} {t.descricao}
                  </option>
                ))}
              </select>
            </div>
          )}

          {'disponivel_corretor' in anexo && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <input
                type="checkbox"
                id="disp_corretor"
                checked={formData.disponivel_corretor}
                onChange={(e) =>
                  setFormData({ ...formData, disponivel_corretor: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="disp_corretor" className="text-sm font-medium text-blue-800 cursor-pointer">
                Exibir na Área do Corretor (UserTie)
              </label>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Salvando...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} /> Salvar Edições
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
