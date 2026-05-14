'use client';

import React, { useState } from 'react';
import { X, Save, Plus, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TemplateBuilderModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'MARKETING',
    language: 'pt_BR',
    body: ''
  });

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    // Only lowercase and underscores
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setFormData({ ...formData, name: val });
  };

  const insertVariable = () => {
    const currentVarsCount = (formData.body.match(/\{\{\d+\}\}/g) || []).length;
    const nextVar = `{{${currentVarsCount + 1}}}`;
    setFormData({ ...formData, body: formData.body + nextVar });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      return toast.error("O nome do modelo é obrigatório.");
    }
    if (!formData.body) {
      return toast.error("O corpo da mensagem é obrigatório.");
    }

    setLoading(true);

    const varsCount = (formData.body.match(/\{\{\d+\}\}/g) || []).length;
    const bodyComponent = {
      type: 'BODY',
      text: formData.body
    };

    if (varsCount > 0) {
      // A Meta EXIGE exemplos para cada variável, caso contrário rejeita instantaneamente
      const examples = Array.from({ length: varsCount }, (_, i) => `Exemplo${i + 1}`);
      bodyComponent.example = {
        body_text: [examples]
      };
    }

    const payload = {
      name: formData.name,
      category: formData.category,
      language: formData.language,
      components: [bodyComponent]
    };

    try {
      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro desconhecido ao criar modelo.');
      }

      toast.success('Modelo enviado para análise com sucesso!');
      onSuccess(); // Re-fetch the templates
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Lado Esquerdo: Formulário */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <MessageCircle className="text-emerald-500" />
              Criar Novo Modelo
            </h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors md:hidden">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome do Modelo Interno</label>
              <input
                type="text"
                value={formData.name}
                onChange={handleNameChange}
                placeholder="ex: boas_vindas_cliente"
                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-3 border bg-gray-50 text-gray-800"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Apenas letras minúsculas e underlines.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-3 border bg-white text-gray-800"
                >
                  <option value="MARKETING">Marketing (Vendas, Ofertas)</option>
                  <option value="UTILITY">Utilidade (Avisos, Atualizações)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Idioma</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-3 border bg-gray-100 text-gray-800 cursor-not-allowed"
                  disabled
                >
                  <option value="pt_BR">Português (Brasil)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-gray-700">Mensagem (Corpo)</label>
                <button 
                  type="button" 
                  onClick={insertVariable}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> Variável {'{{x}}'}
                </button>
              </div>
              <textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={6}
                maxLength={1024}
                placeholder="Olá {{1}}, tudo bem? Seu contrato vence no dia {{2}}."
                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-3 border bg-white text-gray-800 resize-none"
                required
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${formData.body.length >= 1000 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {formData.body.length}/1024
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95"
                disabled={loading}
              >
                {loading ? 'Enviando...' : <><Save size={16} /> Salvar e Enviar para Análise</>}
              </button>
            </div>
          </form>
        </div>

        {/* Lado Direito: Preview */}
        <div className="w-full md:w-[350px] bg-slate-50 border-l border-gray-100 p-6 flex flex-col relative hidden md:flex">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
          
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 mt-2 text-center">Preview (Como fica)</h3>
          
          {/* Mockup Celular Simples */}
          <div className="flex-1 rounded-3xl bg-[#e5ddd5] overflow-hidden border-8 border-white shadow-xl flex flex-col relative">
            {/* Header Mockup */}
            <div className="bg-[#075e54] text-white p-3 flex items-center gap-2 shadow-md z-10">
              <div className="w-8 h-8 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold">Sua Empresa</div>
                <div className="text-[10px] text-white/70">conta comercial</div>
              </div>
            </div>
            
            {/* Background Pattern (Simulado) */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover mix-blend-multiply" />
            
            <div className="flex-1 p-3 overflow-y-auto z-10 flex flex-col gap-2 pt-4">
              {/* Balão do Template */}
              {formData.body ? (
                <div className="bg-white p-2.5 rounded-lg rounded-tl-none shadow-sm max-w-[85%] self-start border border-gray-100 relative">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-snug break-words">
                    {/* Renderiza as variáveis com destaque visual */}
                    {formData.body.split(/(\{\{\d+\}\})/).map((part, i) => 
                      part.match(/\{\{\d+\}\}/) 
                        ? <span key={i} className="bg-emerald-100 text-emerald-800 font-mono text-xs px-1 rounded mx-0.5">{part}</span> 
                        : <span key={i}>{part}</span>
                    )}
                  </p>
                  <div className="text-[10px] text-gray-400 text-right mt-1.5 flex justify-end items-center gap-1">
                    <span>12:00</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-center text-gray-400 mt-10 bg-white/50 py-2 rounded-lg italic">
                  Comece a digitar para ver o preview.
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500 text-center px-4">
            Após salvar, a Meta aprovará o template automaticamente em até 2 minutos se não houver violação de políticas.
          </div>
        </div>

      </div>
    </div>
  );
}
