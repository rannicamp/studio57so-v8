// components/crm/AutomacaoModal.js
"use client";

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const fetchModalData = async (supabase, organizacaoId) => {
  if (!organizacaoId) return { funis: [], templates: [], campaigns: [], origens: [] };
  
  const [funisResult, templatesResponse, contatosResult] = await Promise.all([
    supabase.from('funis').select('id, nome, colunas_funil(id, nome)').eq('organizacao_id', organizacaoId),
    fetch('/api/whatsapp/templates'),
    supabase.from('contatos').select('origem, meta_campaign_id, meta_campaign_name').eq('organizacao_id', organizacaoId)
  ]);

  if (funisResult.error) throw new Error('Erro ao buscar funis.');
  const funis = funisResult.data || [];

  if (!templatesResponse.ok) throw new Error('Erro ao buscar modelos de mensagem.');
  const templates = await templatesResponse.json();

  const contatos = contatosResult.data || [];
  
  const campaigns = [...new Map(
    contatos.filter(c => c.meta_campaign_id && c.meta_campaign_name).map(c => [c.meta_campaign_id, { id: c.meta_campaign_id, nome: c.meta_campaign_name }])
  ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

  const origens = [...new Set(contatos.filter(c => c.origem).map(c => c.origem))].sort();

  return { funis, templates, campaigns, origens };
};

export default function AutomacaoModal({ isOpen, onClose, onSave, automation, supabase, organizacaoId }) {
  const [nome, setNome] = useState('');
  const [gatilhoTipo, setGatilhoTipo] = useState('MOVER_CARD');
  const [funilId, setFunilId] = useState('');
  const [colunaId, setColunaId] = useState('');
  const [templateNome, setTemplateNome] = useState('');
  const [templateIdioma, setTemplateIdioma] = useState('');

  // Condições
  const [condicaoTipo, setCondicaoTipo] = useState('');
  const [condicaoOrigem, setCondicaoOrigem] = useState('');
  const [condicaoCampanha, setCondicaoCampanha] = useState('');

 const { data: modalData, isLoading } = useQuery({
 queryKey: ['automationModalData', organizacaoId],
 queryFn: () => fetchModalData(supabase, organizacaoId),
 enabled: isOpen && !!organizacaoId,
 });

  useEffect(() => {
    if (automation) {
      setNome(automation.nome || '');
      setGatilhoTipo(automation.gatilho_tipo || 'MOVER_CARD');
      setFunilId(automation.gatilho_config?.funil_id || '');
      setColunaId(automation.gatilho_config?.coluna_id || '');
      setTemplateNome(automation.acao_config?.template_nome || '');
      setTemplateIdioma(automation.acao_config?.template_idioma || '');
      
      setCondicaoTipo(automation.gatilho_config?.condicoes?.tipo || '');
      setCondicaoOrigem(automation.gatilho_config?.condicoes?.origem || '');
      setCondicaoCampanha(automation.gatilho_config?.condicoes?.campanha_id || '');
    } else {
      setNome('');
      setGatilhoTipo('MOVER_CARD');
      setFunilId('');
      setColunaId('');
      setTemplateNome('');
      setTemplateIdioma('');
      setCondicaoTipo('');
      setCondicaoOrigem('');
      setCondicaoCampanha('');
    }
  }, [automation, isOpen]);

 const handleTemplateChange = (e) => {
 const selectedTemplate = modalData?.templates.find(t => t.name === e.target.value);
 if (selectedTemplate) {
 setTemplateNome(selectedTemplate.name);
 setTemplateIdioma(selectedTemplate.language);
 }
 };

  const handleSave = () => {
    if (!nome || !gatilhoTipo || !funilId || !colunaId || !templateNome) {
      toast.error("Por favor, preencha todos os campos obrigatórios (marcados com *).");
      return;
    }

    const condicoes = {};
    if (condicaoTipo) condicoes.tipo = condicaoTipo;
    if (condicaoOrigem) condicoes.origem = condicaoOrigem;
    if (condicaoCampanha) condicoes.campanha_id = condicaoCampanha;

    const gatilho_config = { funil_id: funilId, coluna_id: colunaId };
    if (Object.keys(condicoes).length > 0) {
      gatilho_config.condicoes = condicoes;
    }

    const automationData = {
      nome,
      gatilho_tipo: gatilhoTipo,
      gatilho_config,
      acao_tipo: 'ENVIAR_WHATSAPP',
      acao_config: { template_nome: templateNome, template_idioma: templateIdioma },
      ativo: true,
      organizacao_id: organizacaoId,
    };
 if (automation?.id) {
 automationData.id = automation.id;
 }
 onSave(automationData);
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
 <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl">
 <div className="flex justify-between items-center mb-6 border-b pb-4">
 <h3 className="text-xl font-bold text-gray-800">{automation ? 'Editar Automação' : 'Criar Nova Automação'}</h3>
 <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
 </div>

 {isLoading ? (
 <div className="flex justify-center items-center h-48"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
 ) : (
 <div className="space-y-6">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Automação</label>
 <input type="text" placeholder="Ex: Enviar proposta após mover card" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
 </div>

          <div className="p-4 border rounded-md bg-gray-50/50">
            <label className="block text-lg font-semibold text-gray-800 mb-3">QUANDO... (Gatilho)</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ação *</label>
                <select value={gatilhoTipo} onChange={(e) => setGatilhoTipo(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                  <option value="MOVER_CARD">Card entrar na coluna</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Funil *</label>
                <select value={funilId} onChange={(e) => { setFunilId(e.target.value); setColunaId(''); }} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                  <option value="" disabled>Selecione o Funil...</option>
                  {modalData?.funis.map(f => (<option key={f.id} value={f.id}>{f.nome}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Coluna *</label>
                <select value={colunaId} onChange={(e) => setColunaId(e.target.value)} disabled={!funilId} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100">
                  <option value="" disabled>Selecione a Coluna...</option>
                  {modalData?.funis.find(f => String(f.id) === String(funilId))?.colunas_funil?.map(col => (
                    <option key={col.id} value={col.id}>{col.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 border border-blue-100 rounded-md bg-blue-50/30">
            <label className="block text-lg font-semibold text-blue-800 mb-3">SE... (Condições Opcionais)</label>
            <p className="text-xs text-blue-600 mb-4">A automação só será disparada se o cliente bater com os filtros abaixo. Deixe em "Qualquer" para disparar sempre.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Contato</label>
                <select value={condicaoTipo} onChange={(e) => setCondicaoTipo(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                  <option value="">Qualquer tipo</option>
                  <option value="Lead">Lead</option>
                  <option value="Cliente">Cliente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Empreendimento/Campanha</label>
                <select value={condicaoCampanha} onChange={(e) => setCondicaoCampanha(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                  <option value="">Qualquer campanha</option>
                  {modalData?.campaigns.map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Origem</label>
                <select value={condicaoOrigem} onChange={(e) => setCondicaoOrigem(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                  <option value="">Qualquer origem</option>
                  {modalData?.origens.map(o => (<option key={o} value={o}>{o}</option>))}
                </select>
              </div>
            </div>
          </div>

 <div className="p-4 border rounded-md bg-gray-50/50">
 <label className="block text-lg font-semibold text-gray-800 mb-3">ENTÃO...</label>
 <div>
 <label className="block text-sm font-medium text-gray-700">Enviar o modelo de WhatsApp:</label>
 <select value={templateNome} onChange={handleTemplateChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
 <option value="" disabled>Selecione o modelo...</option>
 {modalData?.templates.map(temp => (<option key={temp.id} value={temp.name}>{temp.name} ({temp.language})</option>))}
 </select>
 </div>
 </div>
 </div>
 )}

 <div className="mt-8 flex justify-end gap-3">
 <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
 <button onClick={handleSave} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
 <FontAwesomeIcon icon={faSave} /> Salvar Automação
 </button>
 </div>
 </div>
 </div>
 );
}