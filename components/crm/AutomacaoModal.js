// components/crm/AutomacaoModal.js
"use client";

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const fetchModalData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { colunas: [], templates: [] };
    const colunasPromise = supabase.from('funis').select('colunas_funil(id, nome)').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    const templatesPromise = fetch('/api/whatsapp/templates');
    const [colunasResult, templatesResponse] = await Promise.all([colunasPromise, templatesPromise]);
    if (colunasResult.error) throw new Error('Erro ao buscar colunas do funil.');
    const colunas = colunasResult.data?.colunas_funil || [];
    if (!templatesResponse.ok) throw new Error('Erro ao buscar modelos de mensagem.');
    const templates = await templatesResponse.json();
    return { colunas, templates };
};

export default function AutomacaoModal({ isOpen, onClose, onSave, automation, supabase, organizacaoId }) {
    const [nome, setNome] = useState('');
    const [gatilhoTipo, setGatilhoTipo] = useState('MOVER_CARD'); // Valor padrão
    const [colunaId, setColunaId] = useState('');
    const [templateNome, setTemplateNome] = useState('');
    const [templateIdioma, setTemplateIdioma] = useState('');

    const { data: modalData, isLoading } = useQuery({
        queryKey: ['automationModalData', organizacaoId],
        queryFn: () => fetchModalData(supabase, organizacaoId),
        enabled: isOpen && !!organizacaoId,
    });

    useEffect(() => {
        if (automation) {
            setNome(automation.nome);
            setGatilhoTipo(automation.gatilho_tipo || 'MOVER_CARD');
            setColunaId(automation.gatilho_config?.coluna_id || '');
            setTemplateNome(automation.acao_config?.template_nome || '');
            setTemplateIdioma(automation.acao_config?.template_idioma || '');
        } else {
            setNome('');
            setGatilhoTipo('MOVER_CARD');
            setColunaId('');
            setTemplateNome('');
            setTemplateIdioma('');
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
        if (!nome || !gatilhoTipo || !colunaId || !templateNome) {
            toast.error("Por favor, preencha todos os campos.");
            return;
        }

        const automationData = {
            nome,
            gatilho_tipo: gatilhoTipo,
            gatilho_config: { coluna_id: colunaId },
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
                            <label className="block text-lg font-semibold text-gray-800 mb-3">QUANDO...</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">O gatilho for:</label>
                                    <select value={gatilhoTipo} onChange={(e) => setGatilhoTipo(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                                        <option value="MOVER_CARD">Card MOVIDO para a coluna...</option>
                                        <option value="CRIAR_CARD">Novo card CRIADO na coluna...</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">A coluna for:</label>
                                    <select value={colunaId} onChange={(e) => setColunaId(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                                        <option value="" disabled>Selecione a coluna do funil...</option>
                                        {modalData?.colunas.map(col => (<option key={col.id} value={col.id}>{col.nome}</option>))}
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