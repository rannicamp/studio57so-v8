"use client";

import { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowDown, faMobileAlt, faColumns, faSave, faSpinner, faMagic, faLink
} from '@fortawesome/free-solid-svg-icons';
// Importação do novo gerenciador
import VariableManagerModal from './VariableManagerModal';
import { AVAILABLE_ICONS } from './constants';
// Importação do hook de persistência
import { usePersistentState } from '@/hooks/usePersistentState';

export default function RegraForm({ initialData, tabelas, campos, funcoes, variaveisVirtuais, onSubmit, isSaving, onCancel }) {
  
  // Valor padrão caso não tenha persistência nem dados iniciais
  const defaultValues = {
    nome_regra: '', tabela_alvo: '', evento: 'INSERT',
    coluna_monitorada: '', valor_gatilho: '',
    funcoes_ids: [], enviar_para_dono: false, enviar_push: true,
    titulo_template: 'Nova notificação', mensagem_template: '{conteudo}', link_template: '/', 
    ativo: true, icone: 'fa-bell'
  };

  // Usa 'notif_formData' para lembrar o que estava sendo digitado (Persistência)
  const [formData, setFormData] = usePersistentState('notif_formData', initialData || defaultValues);

  // Sincroniza se o initialData mudar (ex: usuário clicou em editar outra regra enquanto o form estava montado)
  useEffect(() => {
      if (initialData) {
          setFormData(initialData);
      }
  }, [initialData, setFormData]);

  const [showSuggestions, setShowSuggestions] = useState({ visible: false, field: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [showLinkerModal, setShowLinkerModal] = useState(false);

  // Calcula todas as variáveis disponíveis para a tabela selecionada
  const todasVariaveis = useMemo(() => {
    if (!formData.tabela_alvo) return [];
    
    let variaveis = [];
    
    // A. Colunas Físicas do Banco
    if (tabelas && campos) {
        const tabelaObj = tabelas.find(t => t.nome_tabela === formData.tabela_alvo);
        if (tabelaObj) {
            variaveis = campos
                .filter(c => c.tabela_id === tabelaObj.id)
                .map(c => ({ id: c.nome_coluna, nome: c.nome_coluna, desc: c.tipo_dado, tipo: 'coluna' }));
        }
    }

    // B. Variáveis Virtuais (Criadas pelo Linkador)
    if (variaveisVirtuais) {
        const virtuaisDaTabela = variaveisVirtuais.filter(v => v.tabela_gatilho === formData.tabela_alvo);
        virtuaisDaTabela.forEach(v => {
            variaveis.push({ 
                id: v.nome_variavel, 
                nome: v.nome_variavel, 
                desc: `Link: ${v.tabela_destino}.${v.coluna_retorno}`, 
                tipo: 'virtual' 
            });
        });
    }

    // C. Variáveis Mágicas (Hardcoded/Legado)
    if (formData.tabela_alvo === 'whatsapp_messages') {
        variaveis.push({ id: 'nome_remetente', nome: 'nome_remetente', desc: 'Automático', tipo: 'magic' });
        variaveis.push({ id: 'content', nome: 'content', desc: 'Mensagem', tipo: 'magic' });
    }

    return variaveis;
  }, [formData.tabela_alvo, tabelas, campos, variaveisVirtuais]);

  // Filtra a lista com base no que o usuário digitou após o '{'
  const variaveisFiltradas = useMemo(() => {
    if (!searchTerm) return todasVariaveis;
    return todasVariaveis.filter(v => 
        v.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todasVariaveis, searchTerm]);

  // Manipulador de mudança nos inputs
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // --- LÓGICA DE DETECÇÃO DO AUTOCOMPLETE ---
    if (name === 'titulo_template' || name === 'mensagem_template') {
        const lastOpenBrace = value.lastIndexOf('{');
        const lastCloseBrace = value.lastIndexOf('}');

        // Se a última chave aberta for DEPOIS da última fechada, estamos digitando uma variável
        if (lastOpenBrace > -1 && lastOpenBrace > lastCloseBrace) {
            const termoDigitado = value.slice(lastOpenBrace + 1); 
            setSearchTerm(termoDigitado);
            setShowSuggestions({ visible: true, field: name });
        } else {
            setShowSuggestions({ visible: false, field: null });
            setSearchTerm('');
        }
    }

    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Insere a variável selecionada no texto
  const insertVariable = (variableName) => {
    if (!showSuggestions.field) return;

    setFormData(prev => {
        const fieldName = showSuggestions.field;
        const currentValue = prev[fieldName];
        
        // Encontra onde está o último '{' que iniciou essa busca
        const lastOpenBrace = currentValue.lastIndexOf('{');
        
        // Pega tudo antes do '{' e descarta o que foi digitado parcialmente após ele
        const prefix = currentValue.slice(0, lastOpenBrace);
        
        // Monta o novo texto: Prefixo + {Variavel} + Espaço
        return {
            ...prev,
            [fieldName]: `${prefix}{${variableName}} ` 
        };
    });
    
    // Limpa estado e foca
    setShowSuggestions({ visible: false, field: null });
    setSearchTerm('');
  };

  const handleMultiSelect = (e) => {
    const options = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({ ...prev, funcoes_ids: options }));
  };

  return (
    <div className="space-y-6">
      {/* HEADER DO FORMULÁRIO */}
      <div className="flex items-center justify-between border-b pb-4">
        <h3 className="text-lg font-bold text-gray-800">
          {initialData?.id ? 'Editar Regra' : initialData ? 'Nova Regra (Cópia)' : 'Nova Regra de Notificação'}
        </h3>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">
          Voltar para lista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUNA 1: IDENTIDADE */}
        <div className="md:col-span-1 space-y-4">
           <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Identidade</label>
              <input required name="nome_regra" value={formData.nome_regra} onChange={handleChange} className="w-full p-2.5 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none mb-4" placeholder="Nome da Regra" />
              <div className="grid grid-cols-5 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                {AVAILABLE_ICONS.map((item) => (
                    <button key={item.name} type="button" onClick={() => setFormData(prev => ({ ...prev, icone: item.name }))} className={`aspect-square rounded-md flex items-center justify-center text-lg transition-all ${formData.icone === item.name ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'text-gray-400 hover:bg-gray-200'}`} title={item.label}>
                        <FontAwesomeIcon icon={item.icon} />
                    </button>
                ))}
              </div>
           </div>
        </div>

        {/* COLUNA 2: CONFIGURAÇÃO (GATILHO + AÇÃO) */}
        <div className="md:col-span-2 space-y-4">
            
            {/* SESSÃO 1: ONDE (GATILHO) */}
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm relative">
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                     <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-bl-full -mr-8 -mt-8"></div>
                </div>

                <div className="relative z-10">
                    <h4 className="text-xs font-bold text-blue-800 uppercase mb-4 flex items-center gap-2">
                        <span className="bg-blue-200 px-2 py-0.5 rounded text-[10px]">1</span> Onde (Gatilho)
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">Módulo / Tabela</label>
                            <select required name="tabela_alvo" value={formData.tabela_alvo} onChange={handleChange} className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white">
                                <option value="">Selecione...</option>
                                {tabelas && tabelas.map(t => <option key={t.id} value={t.nome_tabela}>{t.nome_exibicao} ({t.modulo})</option>)}
                                <option value="activities">Atividades (Manual)</option>
                                <option value="whatsapp_messages">WhatsApp (Manual)</option>
                                <option value="produtos_empreendimento">Produtos (Manual)</option>
                                <option value="contratos">Contratos (Manual)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">Evento</label>
                            <select name="evento" value={formData.evento} onChange={handleChange} className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white">
                                <option value="INSERT">Ao Criar</option>
                                <option value="UPDATE">Ao Atualizar</option>
                                <option value="DELETE">Ao Excluir</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-blue-200/50">
                        <p className="text-[10px] font-bold text-blue-400 mb-2 uppercase">Filtro (Opcional)</p>
                        <div className="flex gap-2">
                            <div className="w-1/2 relative">
                                <select name="coluna_monitorada" value={formData.coluna_monitorada || ''} onChange={handleChange} className="w-full p-2 border border-blue-200 rounded-lg text-xs bg-white appearance-none">
                                    <option value="">-- Qualquer Coluna --</option>
                                    {todasVariaveis.filter(v => v.tipo === 'coluna').map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                </select>
                                <div className="absolute right-2 top-2.5 text-blue-300 pointer-events-none text-xs"><FontAwesomeIcon icon={faColumns} /></div>
                            </div>
                            <div className="flex items-center text-blue-300 font-bold">=</div>
                            <input name="valor_gatilho" value={formData.valor_gatilho || ''} onChange={handleChange} className="w-1/2 p-2 border border-blue-200 rounded-lg text-xs" placeholder="Valor (ex: Concluído)" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-white border rounded-full p-1 text-gray-300 shadow-sm"><FontAwesomeIcon icon={faArrowDown} /></div>
            </div>

            {/* SESSÃO 2: AÇÃO (NOTIFICAR) */}
            <div className="bg-orange-50 p-5 rounded-xl border border-orange-100 shadow-sm relative">
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100 rounded-bl-full -mr-8 -mt-8"></div>
                </div>

                <div className="relative z-10">
                    <h4 className="text-xs font-bold text-orange-800 uppercase mb-4 flex items-center gap-2">
                        <span className="bg-orange-200 px-2 py-0.5 rounded text-[10px]">2</span> Ação (Notificar)
                    </h4>

                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-orange-600 mb-1 uppercase">Quem recebe?</label>
                        <div className="flex gap-3">
                            <select multiple name="funcoes_ids" value={formData.funcoes_ids || []} onChange={handleMultiSelect} className="flex-1 p-2 border border-orange-200 rounded-lg text-sm h-20 bg-white">
                                {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome_funcao}</option>)}
                            </select>
                            <div className="w-1/3 flex flex-col gap-2">
                                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-orange-200 hover:bg-orange-100/50 transition-colors h-full">
                                    <input type="checkbox" name="enviar_para_dono" checked={formData.enviar_para_dono} onChange={handleChange} className="text-orange-500 rounded" />
                                    <span className="text-xs font-bold text-gray-600">Dono</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        {/* CAMPO TÍTULO */}
                        <input required name="titulo_template" value={formData.titulo_template} onChange={handleChange} className="w-full p-2 border border-orange-200 rounded-lg text-sm font-bold placeholder-orange-300" placeholder="Título (Digite { para variáveis)" autoComplete="off"/>
                        
                        {/* CAMPO MENSAGEM */}
                        <textarea required name="mensagem_template" value={formData.mensagem_template} onChange={handleChange} rows="2" className="w-full p-2 border border-orange-200 rounded-lg text-sm placeholder-orange-300" placeholder="Mensagem... (Digite { para variáveis)" autoComplete="off" />
                        
                        {/* LISTA SUSPENSA (DROPDOWN) DE VARIÁVEIS - FILTRADA */}
                        {showSuggestions.visible && (
                            <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 shadow-xl rounded-lg max-h-48 overflow-y-auto animate-fade-in mt-1">
                                <div className="bg-gray-50 px-3 py-1 text-[10px] text-gray-500 font-bold border-b flex justify-between items-center sticky top-0">
                                    <span>
                                        {searchTerm ? `FILTRANDO: "${searchTerm}"` : 'VARIÁVEIS DISPONÍVEIS'}
                                    </span>
                                    <button onClick={() => {setShowSuggestions({visible:false, field: null}); setSearchTerm('')}} className="text-red-400 hover:text-red-600 px-2 font-bold">x</button>
                                </div>
                                
                                {variaveisFiltradas.length > 0 ? (
                                    variaveisFiltradas.map((col) => (
                                        <button
                                            key={col.id}
                                            type="button"
                                            onClick={() => insertVariable(col.nome)}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-700 hover:text-blue-700 border-b border-gray-50 last:border-0 flex justify-between group transition-colors items-center"
                                        >
                                            <span className={`font-mono font-bold ${col.tipo === 'virtual' ? 'text-purple-600' : 'text-blue-600'}`}>
                                                {col.tipo === 'virtual' && <FontAwesomeIcon icon={faLink} className="mr-1 text-[10px]"/>}
                                                {`{${col.nome}}`}
                                            </span>
                                            <span className="text-[10px] text-gray-400 group-hover:text-blue-400">{col.desc || 'texto'}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-3 text-center text-xs text-gray-400 italic">
                                        Nenhuma variável encontrada com "{searchTerm}"
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-between items-center">
                            <p className="text-[10px] text-gray-400">
                                <FontAwesomeIcon icon={faMagic} className="text-purple-400 mr-1"/>
                                Digite <strong>{'{'}</strong> para inserir variáveis.
                            </p>
                            
                            {/* BOTÃO DO GERENCIADOR DE VARIÁVEIS */}
                            <button 
                                type="button" 
                                onClick={() => setShowLinkerModal(true)}
                                className="text-[10px] font-bold text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                disabled={!formData.tabela_alvo}
                                title={!formData.tabela_alvo ? "Selecione uma tabela primeiro" : "Gerenciar vínculos com outras tabelas"}
                            >
                                <FontAwesomeIcon icon={faLink} /> Variáveis & Links
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-orange-200/50 flex justify-between items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-8 h-4 rounded-full transition-colors relative ${formData.enviar_push ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${formData.enviar_push ? 'left-4.5' : 'left-0.5'}`}></div>
                            </div>
                            <input type="checkbox" name="enviar_push" checked={formData.enviar_push} onChange={handleChange} className="sr-only" />
                            <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                <FontAwesomeIcon icon={faMobileAlt} /> Push
                            </span>
                        </label>
                        <input name="link_template" value={formData.link_template || ''} onChange={handleChange} className="w-1/2 p-1.5 border border-orange-200 rounded text-xs bg-white text-right" placeholder="Link (opcional)" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="pt-6 border-t flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Cancelar
        </button>
        <button type="button" onClick={() => onSubmit(formData)} disabled={isSaving || !formData.nome_regra || !formData.tabela_alvo} className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50 transition-all transform active:scale-95">
            {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            Salvar
        </button>
      </div>

      {/* MODAL LINKADOR (GERENCIADOR) */}
      <VariableManagerModal 
        isOpen={showLinkerModal} 
        onClose={() => setShowLinkerModal(false)}
        tabelaGatilho={formData.tabela_alvo}
        tabelas={tabelas}
        campos={campos}
      />
    </div>
  );
}