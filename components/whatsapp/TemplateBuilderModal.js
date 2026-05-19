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
    body: '',
    headerType: 'NONE',
    headerText: '',
    headerImageBase64: null,
    headerImageMime: null,
    headerImagePreview: null,
    buttons: []
  });

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    // Only lowercase and underscores
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setFormData({ ...formData, name: val });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("A imagem deve ter no máximo 5MB.");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result.split(',')[1];
      setFormData({ 
        ...formData, 
        headerImageBase64: base64String,
        headerImageMime: file.type,
        headerImagePreview: event.target.result
      });
    };
    reader.readAsDataURL(file);
  };

  const insertVariable = () => {
    const currentVarsCount = (formData.body.match(/\{\{\d+\}\}/g) || []).length;
    const nextVar = `{{${currentVarsCount + 1}}}`;
    setFormData({ ...formData, body: formData.body + nextVar });
  };

  const handleAddButton = () => {
    if (formData.buttons.length >= 3) {
      return toast.error("Você pode adicionar no máximo 3 botões.");
    }
    setFormData({
      ...formData,
      buttons: [...formData.buttons, { type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '' }]
    });
  };

  const handleRemoveButton = (index) => {
    const newButtons = [...formData.buttons];
    newButtons.splice(index, 1);
    setFormData({ ...formData, buttons: newButtons });
  };

  const handleButtonChange = (index, field, value) => {
    const newButtons = [...formData.buttons];
    newButtons[index][field] = value;
    setFormData({ ...formData, buttons: newButtons });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      return toast.error("O nome do modelo é obrigatório.");
    }
    if (!formData.body) {
      return toast.error("O corpo da mensagem é obrigatório.");
    }
    if (formData.headerType === 'TEXT' && !formData.headerText.trim()) {
      return toast.error("O texto do cabeçalho é obrigatório.");
    }
    if (formData.headerType === 'IMAGE' && !formData.headerImageBase64) {
      return toast.error("Por favor, selecione uma imagem de amostra para o cabeçalho.");
    }
    
    for (let i = 0; i < formData.buttons.length; i++) {
      const btn = formData.buttons[i];
      if (!btn.text.trim()) return toast.error(`O texto do botão ${i + 1} é obrigatório.`);
      if (btn.type === 'URL' && !btn.url.trim()) return toast.error(`A URL do botão ${i + 1} é obrigatória.`);
      if (btn.type === 'PHONE_NUMBER' && !btn.phoneNumber.trim()) return toast.error(`O telefone do botão ${i + 1} é obrigatório.`);
    }

    setLoading(true);

    const components = [];

    if (formData.headerType === 'TEXT') {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: formData.headerText
      });
    } else if (formData.headerType === 'IMAGE') {
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
        __localImage: {
          base64: formData.headerImageBase64,
          mime: formData.headerImageMime
        }
      });
    }

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

    components.push(bodyComponent);

    if (formData.buttons.length > 0) {
      const formattedButtons = formData.buttons.map(btn => {
        if (btn.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: btn.text };
        if (btn.type === 'URL') return { type: 'URL', text: btn.text, url: btn.url };
        if (btn.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phoneNumber };
        return null;
      }).filter(Boolean);
      
      components.push({
        type: 'BUTTONS',
        buttons: formattedButtons
      });
    }

    const payload = {
      name: formData.name,
      category: formData.category,
      language: formData.language,
      components: components
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

            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cabeçalho Opcional (Topo da Mensagem)</label>
              <select
                value={formData.headerType}
                onChange={(e) => setFormData({ ...formData, headerType: e.target.value })}
                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-3 border bg-white text-gray-800 mb-3"
              >
                <option value="NONE">Nenhum cabeçalho</option>
                <option value="TEXT">Texto (Título em negrito)</option>
                <option value="IMAGE">Imagem</option>
              </select>

              {formData.headerType === 'TEXT' && (
                <div>
                  <input
                    type="text"
                    value={formData.headerText}
                    onChange={(e) => setFormData({ ...formData, headerText: e.target.value })}
                    maxLength={60}
                    placeholder="Título (ex: OFERTA IMPERDÍVEL)"
                    className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-3 border bg-white text-gray-800"
                  />
                  <div className="text-right text-xs text-gray-400 mt-1">{formData.headerText.length}/60</div>
                </div>
              )}

              {formData.headerType === 'IMAGE' && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-gray-500 bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-100">
                    <strong>Importante:</strong> Esta imagem é enviada apenas como <em>amostra</em> para a aprovação da Meta. Você poderá usar qualquer imagem no envio real.
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg, image/png"
                    onChange={handleImageUpload}
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                  {formData.headerImagePreview && (
                    <img src={formData.headerImagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-gray-200 mt-2 shadow-sm" />
                  )}
                </div>
              )}
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

            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">Botões de Ação (Opcional)</label>
                {formData.buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="text-xs text-blue-600 hover:text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar Botão
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">Você pode adicionar no máximo 3 botões.</p>

              <div className="space-y-3">
                {formData.buttons.map((btn, index) => (
                  <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(index)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Botão</label>
                        <select
                          value={btn.type}
                          onChange={(e) => handleButtonChange(index, 'type', e.target.value)}
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-2 border bg-gray-50"
                        >
                          <option value="QUICK_REPLY">Resposta Rápida (Texto)</option>
                          <option value="URL">Acessar Site (Link)</option>
                          <option value="PHONE_NUMBER">Ligar (Telefone)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Texto do Botão</label>
                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) => handleButtonChange(index, 'text', e.target.value)}
                          maxLength={25}
                          placeholder="Ex: Sim, quero saber mais"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-2 border bg-white"
                        />
                        <div className="text-right text-[10px] text-gray-400 mt-1">{btn.text.length}/25</div>
                      </div>
                    </div>

                    {btn.type === 'URL' && (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Link (URL completa)</label>
                        <input
                          type="url"
                          value={btn.url}
                          onChange={(e) => handleButtonChange(index, 'url', e.target.value)}
                          placeholder="https://studio57.arq.br"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-2 border bg-white"
                        />
                      </div>
                    )}
                    {btn.type === 'PHONE_NUMBER' && (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Número de Telefone (com DDI)</label>
                        <input
                          type="text"
                          value={btn.phoneNumber}
                          onChange={(e) => handleButtonChange(index, 'phoneNumber', e.target.value)}
                          placeholder="+5531999999999"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm p-2 border bg-white"
                        />
                      </div>
                    )}
                  </div>
                ))}
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
                <>
                <div className="bg-white p-2.5 rounded-lg rounded-tl-none shadow-sm max-w-[85%] self-start border border-gray-100 relative">
                  
                  {/* Render Header se houver */}
                  {formData.headerType === 'TEXT' && formData.headerText && (
                    <div className="font-bold text-gray-900 text-sm mb-1">{formData.headerText}</div>
                  )}
                  {formData.headerType === 'IMAGE' && formData.headerImagePreview && (
                    <div className="mb-2">
                      <img src={formData.headerImagePreview} alt="Header" className="w-full rounded-md object-cover" />
                    </div>
                  )}
                  {formData.headerType === 'IMAGE' && !formData.headerImagePreview && (
                    <div className="mb-2 bg-gray-200 h-24 rounded-md flex items-center justify-center text-gray-400 text-xs">
                      [Imagem]
                    </div>
                  )}

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

                
                {/* Botões Preview */}
                {formData.buttons.length > 0 && (
                  <div className="flex flex-col gap-1 max-w-[85%] self-start w-full">
                    {formData.buttons.map((btn, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-100 flex items-center justify-center gap-2 text-[#00a884] font-semibold text-sm cursor-pointer">
                        {btn.type === 'URL' && (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                          </svg>
                        )}
                        {btn.type === 'PHONE_NUMBER' && (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                          </svg>
                        )}
                        {btn.type === 'QUICK_REPLY' && (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                          </svg>
                        )}
                        {btn.text || "Novo Botão"}
                      </div>
                    ))}
                  </div>
                )}
              </>
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
