"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileCsv, faSpinner, faArrowRight, faCogs, faMagic, faCheckCircle, faPlusCircle, faBan, faExclamationTriangle, faBuilding } from '@fortawesome/free-solid-svg-icons';
import Papa from 'papaparse';

// Componente para um único passo no assistente
const Step = ({ number, title, isActive, isCompleted }) => (
    <div className="flex items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isCompleted ? 'bg-green-500 text-white' : (isActive ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600')}`}>
            {isCompleted ? <FontAwesomeIcon icon={faCheckCircle} /> : number}
        </div>
        <div className={`ml-3 text-sm font-medium ${isActive || isCompleted ? 'text-gray-800' : 'text-gray-500'}`}>{title}</div>
    </div>
);

// Componente da Barra de Progresso
const ProgressBar = ({ current, total }) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    return (
        <div className="w-full bg-gray-200 rounded-full h-4">
            <div
                className="bg-blue-500 h-4 rounded-full transition-all duration-300 text-center text-white text-xs font-bold"
                style={{ width: `${percentage}%` }}
            >
               {Math.round(percentage)}%
            </div>
        </div>
    );
};


export default function ImportacaoFinanceiraManager() {
    const supabase = createClient();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    
    // ***** INÍCIO DA MODIFICAÇÃO *****
    const [empresas, setEmpresas] = useState([]);
    const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
    // ***** FIM DA MODIFICAÇÃO *****

    const [file, setFile] = useState(null);
    const [fileHeaders, setFileHeaders] = useState([]);
    const [fileData, setFileData] = useState([]);
    
    const [mappings, setMappings] = useState({});
    const [unmappedData, setUnmappedData] = useState({ contas: new Set(), categorias: new Map(), empreendimentos: new Set(), contatos: new Set() });
    const [dataResolutions, setDataResolutions] = useState({ contas: {}, categorias: {}, empreendimentos: {}, contatos: {} });
    
    const [systemData, setSystemData] = useState({ contas: [], categorias: [], empreendimentos: [], contatos: [] });
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    
    const [importResults, setImportResults] = useState({ success: [], failed: [] });


    const dbColumns = [
        { key: 'data_transacao', label: 'Data da Transação *' },
        { key: 'descricao', label: 'Descrição *' },
        { key: 'valor', label: 'Valor *' },
        { key: 'tipo', label: 'Tipo (Receita/Despesa) *' },
        { key: 'conta_nome', label: 'Conta (Nome) *' },
        { key: 'categoria_nome', label: 'Categoria (Nome)' },
        { key: 'contato_nome', label: 'Contato/Favorecido (Nome)' },
        { key: 'empreendimento_nome', label: 'Empreendimento/Obra (Nome)' },
        { key: 'status', label: 'Situação (Pago/Pendente)' },
        { key: 'observacao', label: 'Observação' },
    ];
    
    // ***** INÍCIO DA MODIFICAÇÃO *****
    // Carrega a lista de empresas quando o componente é montado
    useEffect(() => {
        const fetchEmpresas = async () => {
            const { data, error } = await supabase
                .from('cadastro_empresa')
                .select('id, nome_fantasia, razao_social');
            if (error) {
                console.error('Erro ao buscar empresas:', error);
                setMessage('Erro ao carregar a lista de empresas.');
            } else {
                setEmpresas(data);
            }
        };
        fetchEmpresas();
    }, [supabase]);
    // ***** FIM DA MODIFICAÇÃO *****

    const loadSystemData = useCallback(async () => {
        setIsProcessing(true);
        const [contasRes, categoriasRes, empreendimentosRes, contatosRes] = await Promise.all([
            supabase.from('contas_financeiras').select('id, nome'),
            supabase.from('categorias_financeiras').select('id, nome, parent_id'),
            supabase.from('empreendimentos').select('id, nome'),
            supabase.from('contatos').select('id, nome, razao_social')
        ]);
        setSystemData({
            contas: contasRes.data || [],
            categorias: categoriasRes.data || [],
            empreendimentos: empreendimentosRes.data || [],
            contatos: contatosRes.data || []
        });
        setIsProcessing(false);
    }, [supabase]);

    useEffect(() => { loadSystemData(); }, [loadSystemData]);

    const handleFileSelect = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setMessage(`Arquivo "${selectedFile.name}" selecionado.`);
        }
    };

    const processStep1 = () => {
        // ***** INÍCIO DA MODIFICAÇÃO *****
        // Adicionada verificação para garantir que uma empresa foi selecionada
        if (!selectedEmpresaId) { setMessage("Por favor, selecione uma empresa para continuar."); return; }
        // ***** FIM DA MODIFICAÇÃO *****
        if (!file) { setMessage("Por favor, selecione um arquivo CSV."); return; }
        
        setIsProcessing(true);
        Papa.parse(file, {
            header: true, skipEmptyLines: true, delimiter: ";",
            complete: (results) => {
                setFileHeaders(results.meta.fields);
                setFileData(results.data);
                setStep(2);
                setIsProcessing(false);
                setMessage('');
            },
            error: () => {
                setMessage("Erro ao ler o arquivo CSV. Verifique o formato e o delimitador (;).");
                setIsProcessing(false);
            }
        });
    };

    const processStep2 = () => {
        if (!mappings.data_transacao || !mappings.descricao || !mappings.valor || !mappings.conta_nome || !mappings.tipo) {
            setMessage("Por favor, mapeie os campos obrigatórios: Data, Descrição, Valor, Conta e Tipo.");
            return;
        }
        setIsProcessing(true);
        const uniqueContas = new Set();
        const uniqueCategorias = new Map();
        const uniqueEmpreendimentos = new Set();
        const uniqueContatos = new Set();

        fileData.forEach(row => {
            if (row[mappings.conta_nome]) uniqueContas.add(row[mappings.conta_nome].trim());
            if (row[mappings.empreendimento_nome]) uniqueEmpreendimentos.add(row[mappings.empreendimento_nome].trim());
            if (row[mappings.contato_nome]) uniqueContatos.add(row[mappings.contato_nome].trim());
            
            const categoriaNome = row[mappings.categoria_nome];
            if (categoriaNome) {
                const trimmedNome = categoriaNome.trim();
                if (!uniqueCategorias.has(trimmedNome)) {
                    const tipo = row[mappings.tipo]?.toLowerCase().includes('receita') ? 'Receita' : 'Despesa';
                    uniqueCategorias.set(trimmedNome, tipo);
                }
            }
        });
        
        const filterNewItems = (systemItems, fileItems) => new Set([...fileItems].filter(item => item && !systemItems.some(sysItem => (sysItem.nome || sysItem.razao_social)?.toLowerCase() === item.toLowerCase())));

        const unmappedCategorias = new Map();
        for (const [catPath, tipo] of uniqueCategorias.entries()) {
            if (!catPath) continue;
            const parts = catPath.split(/[\/]/).map(p => p.trim());
            const subCategoryName = parts[parts.length - 1];
            const exists = systemData.categorias.some(sysCat => sysCat.nome.toLowerCase() === subCategoryName.toLowerCase());
            if (!exists) {
                unmappedCategorias.set(catPath, tipo);
            }
        }

        setUnmappedData({
            contas: filterNewItems(systemData.contas, uniqueContas),
            categorias: unmappedCategorias,
            empreendimentos: filterNewItems(systemData.empreendimentos, uniqueEmpreendimentos),
            contatos: filterNewItems(systemData.contatos, uniqueContatos)
        });
        setStep(3);
        setIsProcessing(false);
    };
    
    const handleBulkResolve = (type, action) => {
        const newResolutionsForType = {};
        const itemsToResolve = type === 'categorias' ? unmappedData.categorias.keys() : unmappedData[type];
        
        for (const name of itemsToResolve) {
            newResolutionsForType[name] = { action: action, mapToId: null };
        }
        
        setDataResolutions(prev => ({
            ...prev,
            [type]: { ...prev[type], ...newResolutionsForType }
        }));
    };
    
    const processStep3 = async () => {
        setIsProcessing(true);
        
        const createBatch = async (type, dataSet, insertLogic) => {
            const itemsToInsert = [...dataSet].filter(name => dataResolutions[type][name]?.action === 'create').map(insertLogic);
            if (itemsToInsert.length === 0) return true;

            setMessage(`Criando ${itemsToInsert.length} novo(s) item(ns) do tipo: ${type}...`);
            setProgress({ current: 0, total: itemsToInsert.length });
            
            const tableName = type === 'contatos' ? 'contatos' : (type === 'empreendimentos' ? 'empreendimentos' : `${type}_financeiras`);
            // ***** INÍCIO DA MODIFICAÇÃO *****
            // Adiciona o ID da empresa ao criar novas contas ou contatos
            const itemsWithEmpresaId = itemsToInsert.map(item => ({ ...item, empresa_id: selectedEmpresaId }));
            const { error } = await supabase.from(tableName).insert(itemsWithEmpresaId);
            // ***** FIM DA MODIFICAÇÃO *****
            
            setProgress({ current: itemsToInsert.length, total: itemsToInsert.length });
            if (error) {
                setMessage(`Erro ao criar ${type}: ${error.message}`);
                return false;
            }
            return true;
        };

        const successContas = await createBatch('contas', unmappedData.contas, name => ({ nome: name, tipo: 'Conta Corrente', saldo_inicial: 0 }));
        const successContatos = await createBatch('contatos', unmappedData.contatos, name => ({ nome: name, tipo_contato: 'Fornecedor' }));

        if (!successContas || !successContatos) {
            setIsProcessing(false);
            return;
        }

        const categoriasToCreate = [...unmappedData.categorias.keys()].filter(path => dataResolutions.categorias[path]?.action === 'create');
        if (categoriasToCreate.length > 0) {
            setMessage(`Criando ${categoriasToCreate.length} nova(s) categoria(s)...`);
            setProgress({ current: 0, total: categoriasToCreate.length });
            await loadSystemData();
            for (const catPath of categoriasToCreate) {
                const parts = catPath.split(/[\/]/).map(p => p.trim());
                let parentId = null;
                const tipoCategoria = unmappedData.categorias.get(catPath);
                
                for (const part of parts) {
                    let existingCat = systemData.categorias.find(c => c.nome.toLowerCase() === part.toLowerCase() && c.parent_id === parentId);
                    if (!existingCat) {
                        const { data: newCat } = await supabase.from('categorias_financeiras').insert({ nome: part, tipo: tipoCategoria, parent_id: parentId }).select().single();
                        if (newCat) { parentId = newCat.id; systemData.categorias.push(newCat); }
                    } else { parentId = existingCat.id; }
                }
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
        }
        
        await loadSystemData();
        setMessage("Criação de novos itens concluída! Preparando para importação...");
        await new Promise(res => setTimeout(res, 1500));
        setStep(4);
        setIsProcessing(false);
    };

    const processStep4 = async () => {
        if (!user) {
            setMessage('Erro: Usuário não autenticado. Por favor, faça login novamente.');
            setIsProcessing(false);
            return;
        }
        
        setIsProcessing(true);
        const results = { success: [], failed: [] };
        const BATCH_SIZE = 500;
        
        const lancamentosToInsert = [];

        const parseDate = (dateString) => {
            if (!dateString || typeof dateString !== 'string') return { date: null, error: 'Data em branco' };
            const parts = dateString.split('/');
            if (parts.length !== 3) return { date: null, error: 'Formato de data inválido' };
            const [day, month, year] = parts;
            const isoDate = `${year}-${month}-${day}`;
            if (new Date(isoDate).toString() === 'Invalid Date') return { date: null, error: 'Data inválida' };
            return { date: isoDate, error: null };
        };
        
        const getItemId = (type, name) => {
            if (!name) return { id: null, error: null };
            const resolution = dataResolutions[type][name];
            if (resolution?.action === 'map') return { id: resolution.mapToId, error: null };
            if (resolution?.action === 'ignore') return { id: null, error: null };
            const existing = systemData[type].find(item => (item.nome || item.razao_social)?.toLowerCase() === name.toLowerCase());
            if (existing) return { id: existing.id, error: null };
            return { id: null, error: `Item '${name}' não encontrado.` };
        };

        const getCategoryId = (catPath) => {
             if (!catPath) return { id: null, error: null };
             const resolution = dataResolutions.categorias[catPath];
             if(resolution?.action === 'ignore') return { id: null, error: null };
             const parts = catPath.split(/[\/]/).map(p => p.trim());
             let parentId = null; let finalId = null;
             for (const part of parts) {
                 const found = systemData.categorias.find(c => c.nome.toLowerCase() === part.toLowerCase() && c.parent_id === parentId);
                 if (found) { finalId = found.id; parentId = found.id; }
                 else { return { id: null, error: `Subcategoria '${part}' não encontrada.` }; }
             }
             return { id: finalId, error: null };
        };
        
        for (const row of fileData) {
            const valorStr = (row[mappings.valor] || '0').replace('R$', '').replace('.', '').replace(',', '.').trim();
            const valor = parseFloat(valorStr);
            if (isNaN(valor)) { results.failed.push({ row, error: 'Valor inválido.' }); continue; }
            
            const { date: dataTransacao, error: dateError } = parseDate(row[mappings.data_transacao]);
            if(dateError) { results.failed.push({ row, error: `Data inválida: ${dateError}` }); continue; }
            
            const contaNome = row[mappings.conta_nome]?.trim();
            const { id: conta_id, error: contaError } = getItemId('contas', contaNome);
            if (contaError || !conta_id) { results.failed.push({ row, error: contaError || `Conta '${contaNome}' é obrigatória.` }); continue; }
            
            const tipoLancamento = row[mappings.tipo]?.toLowerCase().includes('receita') ? 'Receita' : 'Despesa';

            const categoriaPath = row[mappings.categoria_nome]?.trim();
            const empreendimentoNome = row[mappings.empreendimento_nome]?.trim();
            const contatoNome = row[mappings.contato_nome]?.trim();
            const situacao = row[mappings.status]?.toLowerCase() || '';

            const { id: categoria_id } = getCategoryId(categoriaPath);
            const { id: empreendimento_id } = getItemId('empreendimentos', empreendimentoNome);
            const { id: favorecido_contato_id } = getItemId('contatos', contatoNome);

            lancamentosToInsert.push({
                // ***** INÍCIO DA MODIFICAÇÃO *****
                // Adiciona o ID da empresa selecionada em cada lançamento
                empresa_id: selectedEmpresaId,
                // ***** FIM DA MODIFICAÇÃO *****
                criado_por_usuario_id: user.id,
                data_transacao: dataTransacao, 
                descricao: row[mappings.descricao], 
                valor: Math.abs(valor),
                tipo: tipoLancamento,
                status: situacao.includes('pago') || situacao.includes('conciliado') ? 'Pago' : 'Pendente',
                data_pagamento: situacao.includes('pago') || situacao.includes('conciliado') ? dataTransacao : null,
                conciliado: situacao.includes('conciliado'), 
                conta_id, 
                categoria_id, 
                empreendimento_id, 
                favorecido_contato_id
            });
        }
        
        setProgress({ current: 0, total: lancamentosToInsert.length });
        setMessage(`Enviando ${lancamentosToInsert.length} lançamentos...`);

        for (let i = 0; i < lancamentosToInsert.length; i += BATCH_SIZE) {
            const batch = lancamentosToInsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from('lancamentos').insert(batch);
            if (error) {
                results.failed.push(...batch.map(row => ({ row, error: "Erro no lote: " + error.message })));
            } else {
                results.success.push(...batch.map(row => ({ row })));
            }
            setProgress(prev => ({ ...prev, current: prev.current + batch.length }));
        }
        
        setImportResults(results);
        setMessage(`${results.success.length} lançamentos importados com sucesso! ${results.failed.length > 0 ? `${results.failed.length} falharam.` : ''}`);
        setIsProcessing(false);
        setStep(5);
    };

    const handleResolutionChange = (type, name, action, mapToId = null) => {
        setDataResolutions(prev => ({ ...prev, [type]: { ...prev[type], [name]: { action, mapToId } } }));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between border-b pb-4">
                <Step number={1} title="Upload" isActive={step === 1} isCompleted={step > 1} />
                <Step number={2} title="Mapear Colunas" isActive={step === 2} isCompleted={step > 2} />
                <Step number={3} title="Resolver Dados" isActive={step === 3} isCompleted={step > 3} />
                <Step number={4} title="Importar" isActive={step === 4} isCompleted={step > 4} />
                <Step number={5} title="Concluído" isActive={step === 5} isCompleted={step > 4} />
            </div>

            {message && <p className="text-center font-semibold p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}
            
            {isProcessing && (step === 3 || step === 4) && (
                <div className="space-y-2">
                    <ProgressBar current={progress.current} total={progress.total} />
                    <p className="text-center text-sm font-medium text-gray-600">
                        Processando {progress.current} de {progress.total}...
                    </p>
                </div>
            )}

            {/*// ***** INÍCIO DA MODIFICAÇÃO ***** */}
            {/* Adicionado o seletor de empresa e alterada a estrutura do passo 1 */}
            {step === 1 && (
                <div className="text-center space-y-6 p-8 border-dashed border-2 rounded-lg">
                     <FontAwesomeIcon icon={faBuilding} className="text-5xl text-gray-400 mb-2"/>
                    <h3 className="text-xl font-semibold">Iniciando a Importação Financeira</h3>
                    <p className="text-sm text-gray-600">Siga os passos para importar seus lançamentos.</p>
                    
                    <div className="max-w-md mx-auto text-left">
                        <label htmlFor="empresa-select" className="block text-sm font-medium text-gray-700 mb-1">
                            1. Para qual empresa você está importando? <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="empresa-select"
                            value={selectedEmpresaId}
                            onChange={(e) => setSelectedEmpresaId(e.target.value)}
                            className="w-full p-2 border rounded-md shadow-sm"
                        >
                            <option value="">-- Escolha uma empresa --</option>
                            {empresas.map(empresa => (
                                <option key={empresa.id} value={empresa.id}>
                                    {empresa.nome_fantasia || empresa.razao_social}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="max-w-md mx-auto text-left">
                         <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-1">
                            2. Selecione o arquivo CSV <span className="text-red-500">*</span>
                         </label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FontAwesomeIcon icon={faFileCsv} className="w-8 h-8 mb-2 text-gray-500"/>
                                    <p className="mb-1 text-sm text-gray-500">
                                        <span className="font-semibold">{file ? file.name : 'Clique para selecionar'}</span>
                                    </p>
                                </div>
                                <input id="file-input" type="file" className="hidden" accept=".csv" onChange={handleFileSelect}/>
                            </label>
                        </div>
                    </div>
                    
                    <button 
                        onClick={processStep1} 
                        disabled={!file || !selectedEmpresaId || isProcessing} 
                        className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                    >
                        {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin /> : <>Avançar <FontAwesomeIcon icon={faArrowRight} /></>}
                    </button>
                </div>
            )}
            {/*// ***** FIM DA MODIFICAÇÃO ***** */}
            
            {step === 2 && (
                <div className="space-y-4">
                    <h3 className="font-bold text-lg">Mapeie as colunas do seu arquivo para os campos do sistema:</h3>
                    <div className="space-y-2">
                        {dbColumns.map(col => (
                            <div key={col.key} className="grid grid-cols-2 gap-4 items-center">
                                <label className="font-medium">{col.label}:</label>
                                <select defaultValue={mappings[col.key] || ''} onChange={e => setMappings(prev => ({ ...prev, [col.key]: e.target.value }))} className="p-2 border rounded-md">
                                    <option value="">-- Não importar --</option>
                                    {fileHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                    <button onClick={processStep2} className="bg-blue-600 text-white px-6 py-2 rounded-md">Avançar</button>
                </div>
            )}
            
            {step === 3 && !isProcessing && (
                <div className="space-y-6">
                     <h3 className="font-bold text-lg">Resolver Itens Não Encontrados</h3>
                     <p className="text-sm">O sistema encontrou alguns itens no seu arquivo que não existem aqui. Decida o que fazer com cada um.</p>
                     
                     {Object.keys(unmappedData).map(type => {
                        const items = type === 'categorias' ? [...unmappedData.categorias.keys()] : [...unmappedData[type]];
                        if (items.length === 0) return null;

                        return (
                            <fieldset key={type} className="p-4 border rounded-md">
                                <legend className="font-semibold px-2 capitalize flex justify-between items-center w-full">
                                    <span>{type} ({items.length})</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleBulkResolve(type, 'create')} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"><FontAwesomeIcon icon={faPlusCircle}/> Criar Todos</button>
                                        <button onClick={() => handleBulkResolve(type, 'ignore')} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"><FontAwesomeIcon icon={faBan}/> Ignorar Todos</button>
                                    </div>
                                </legend>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {items.map(name => (
                                        <div key={name} className="grid grid-cols-3 gap-2 items-center text-sm">
                                            <span className="font-mono bg-gray-100 p-1 rounded truncate" title={name}>{name}</span>
                                            <select value={dataResolutions[type]?.[name]?.action || ''} onChange={(e) => handleResolutionChange(type, name, e.target.value)} className="p-1 border rounded-md">
                                                <option value="">Selecione uma ação...</option>
                                                <option value="create">Criar Novo</option>
                                                <option value="map">Associar a um existente</option>
                                                <option value="ignore">Ignorar este item</option>
                                            </select>
                                            {dataResolutions[type]?.[name]?.action === 'map' && (
                                                <select onChange={e => handleResolutionChange(type, name, 'map', e.target.value)} className="p-1 border rounded-md">
                                                    <option value="">Selecione para associar...</option>
                                                    {systemData[type].map(item => <option key={item.id} value={item.id}>{item.nome || item.razao_social}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </fieldset>
                         );
                     })}
                     <button onClick={processStep3} className="bg-blue-600 text-white px-6 py-2 rounded-md">Avançar</button>
                </div>
            )}
            
            {step === 4 && !isProcessing && (
                <div className="text-center space-y-4">
                    <FontAwesomeIcon icon={faMagic} className="text-5xl text-green-500"/>
                    <h3 className="text-lg font-semibold">Tudo pronto para a importação!</h3>
                    <p>{fileData.length} linhas serão processadas.</p>
                    <button onClick={processStep4} disabled={isProcessing} className="bg-green-600 text-white px-6 py-2 rounded-md">
                        {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Confirmar e Importar'}
                    </button>
                </div>
            )}

            {step === 5 && (
                <div className="space-y-4">
                    <div className="text-center">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-5xl text-green-500"/>
                        <h3 className="text-lg font-semibold mt-2">Importação Concluída!</h3>
                        <p>{message}</p>
                    </div>
                    {importResults.failed.length > 0 && (
                        <div className="border-t pt-4">
                            <h4 className="font-bold text-red-600 flex items-center gap-2"><FontAwesomeIcon icon={faExclamationTriangle}/> Detalhes das Falhas:</h4>
                            <div className="max-h-80 overflow-y-auto border rounded-md mt-2">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2 text-left">Descrição (do arquivo)</th>
                                            <th className="p-2 text-left">Valor</th>
                                            <th className="p-2 text-left">Motivo da Falha</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {importResults.failed.map((item, index) => (
                                            <tr key={index} className="bg-red-50">
                                                <td className="p-2">{item.row[mappings.descricao] || 'N/A'}</td>
                                                <td className="p-2">{item.row[mappings.valor] || 'N/A'}</td>
                                                <td className="p-2 font-semibold">{item.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}