"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFileImport, faFileExport, faBroom, faEdit, faTrash, faSort, faSortUp, faSortDown, faSpinner } from '@fortawesome/free-solid-svg-icons';

import MaterialFormModal from './MaterialFormModal';
import MaterialImporter from './materiais/MaterialImporter';

// Função para converter dados JSON em uma string CSV (sem alterações)
function convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(';'),
        ...data.map(row => 
            headers.map(fieldName => JSON.stringify(row[fieldName] || '', (key, value) => value === null ? '' : value)).join(';')
        )
    ];
    return csvRows.join('\r\n');
}

// NOVO: Nossa função "mágica" para normalizar textos (remover acentos e converter para minúsculas)
const normalizarTexto = (texto) => {
    if (!texto) return '';
    return texto
      .toString()
      .normalize('NFD') // Separa as letras dos acentos
      .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
      .toLowerCase(); // Converte para minúsculas
};


export default function MaterialManager({ initialMaterials }) {
    const supabase = createClient();
    const [materials, setMaterials] = useState(initialMaterials);
    const [message, setMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [originFilter, setOriginFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'ascending' });

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);

    const [fornecedores, setFornecedores] = useState([]);
    useState(() => {
        const fetchFornecedores = async () => {
            const { data } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social');
            setFornecedores(data || []);
        };
        fetchFornecedores();
    }, []);

    const uniqueOrigins = useMemo(() => {
        const origins = new Set(materials.map(m => m.Origem || 'Importado').filter(Boolean));
        return Array.from(origins).sort();
    }, [materials]);

    // ATENÇÃO: Toda a lógica de filtro e ordenação foi atualizada aqui!
    const processedMaterials = useMemo(() => {
        let filtered = [...materials];
        const termoBuscaNormalizado = normalizarTexto(searchTerm);
        const filtroOrigemNormalizado = normalizarTexto(originFilter);

        // Filtro por termo de busca (nome/descrição)
        if (termoBuscaNormalizado) {
            filtered = filtered.filter(mat => {
                const nomeNormalizado = normalizarTexto(mat.nome);
                const descricaoNormalizada = normalizarTexto(mat.descricao);
                return nomeNormalizado.includes(termoBuscaNormalizado) || descricaoNormalizada.includes(termoBuscaNormalizado);
            });
        }

        // Filtro por origem
        if (filtroOrigemNormalizado) {
            filtered = filtered.filter(mat => {
                const origemMaterial = mat.Origem || 'Importado';
                return normalizarTexto(origemMaterial) === filtroOrigemNormalizado;
            });
        }
        
        // Filtros de data (sem alterações)
        if (startDate) filtered = filtered.filter(mat => new Date(mat.created_at) >= new Date(startDate));
        if (endDate) filtered = filtered.filter(mat => new Date(mat.created_at) <= new Date(endDate + 'T23:59:59'));

        // Lógica de ordenação
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                
                // Trata valores nulos ou indefinidos para evitar erros
                if (valA == null || valB == null) {
                    return valA == null ? 1 : -1;
                }

                // Normaliza os textos antes de comparar para ordenação correta
                const valANormalizado = normalizarTexto(valA);
                const valBNormalizado = normalizarTexto(valB);

                if (valANormalizado < valBNormalizado) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valANormalizado > valBNormalizado) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [materials, searchTerm, originFilter, startDate, endDate, sortConfig]);
    
    const requestSort = (key) => { let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending'; setSortConfig({ key, direction }); };
    const getSortIcon = (key) => { if (sortConfig.key !== key) return faSort; return sortConfig.direction === 'ascending' ? faSortUp : faSortDown; };
    const clearFilters = () => { setSearchTerm(''); setOriginFilter(''); setStartDate(''); setEndDate(''); setSortConfig({ key: 'nome', direction: 'ascending' }); };
    const handleOpenAddModal = () => { setEditingMaterial(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (material) => { setEditingMaterial(material); setIsFormModalOpen(true); };
    
    const handleSaveMaterial = async (formData) => {
        const isEditing = Boolean(formData.id);
        let error;
        const dataToSave = { ...formData, descricao: formData.descricao || formData.nome };
        if (!isEditing) dataToSave.Origem = 'Manual';
        
        if (isEditing) {
            const { data, error: updateError } = await supabase.from('materiais').update(dataToSave).eq('id', formData.id).select().single();
            if (!updateError) setMaterials(prev => prev.map(m => m.id === data.id ? data : m));
            error = updateError;
        } else {
            const { data, error: insertError } = await supabase.from('materiais').insert(dataToSave).select().single();
            if (!insertError) setMaterials(prev => [...prev, data]);
            error = insertError;
        }
    
        if (error) {
            alert(`Erro: ${error.message}`);
            return false;
        }
    
        setMessage(`Material ${isEditing ? 'atualizado' : 'criado'}.`);
        setIsFormModalOpen(false);
        setTimeout(() => setMessage(''), 3000);
        return true;
    };
    
    const handleDelete = async (materialId) => {
        if (window.confirm('Tem certeza que deseja excluir este material?')) {
            const { error } = await supabase.from('materiais').delete().eq('id', materialId);
            if (error) { alert(`Erro: ${error.message}`); } else { setMaterials(prev => prev.filter(m => m.id !== materialId)); setMessage('Material excluído.'); setTimeout(() => setMessage(''), 3000); }
        }
    };
    
    const handleImportComplete = async () => {
        setIsImporterOpen(false);
        const { data: updatedMaterials } = await supabase.from('materiais').select('*').order('nome');
        setMaterials(updatedMaterials || []);
    };
    
    const handleExport = async () => { /* ... (código original mantido) ... */ };
    const handlePurge = async () => { /* ... (código original mantido) ... */ };

    const formatDate = (dateString) => { if (!dateString) return 'N/A'; return new Date(dateString).toLocaleDateString('pt-BR'); };

    return (
        <>
            <MaterialFormModal 
                isOpen={isFormModalOpen} 
                onClose={() => setIsFormModalOpen(false)} 
                onSave={handleSaveMaterial} 
                material={editingMaterial}
                fornecedores={fornecedores}
            />
            <MaterialImporter isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)} onImportComplete={handleImportComplete} />

            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <h3 className="text-lg font-semibold text-gray-700 flex-shrink-0">Ações:</h3>
                    <div className="flex gap-2 justify-start flex-wrap">
                        <button onClick={handleOpenAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2"> <FontAwesomeIcon icon={faPlus} /> Adicionar </button>
                        <button onClick={() => setIsImporterOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2"> <FontAwesomeIcon icon={faFileImport} /> Importar </button>
                        <button onClick={handleExport} disabled={isProcessing} className="bg-gray-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-700 flex items-center gap-2 disabled:bg-gray-400"> <FontAwesomeIcon icon={isProcessing ? faSpinner : faFileExport} spin={isProcessing} /> Exportar </button>
                        <button onClick={handlePurge} disabled={isProcessing} className="bg-red-700 text-white px-4 py-2 rounded-md shadow-sm hover:bg-red-800 flex items-center gap-2 disabled:bg-gray-400"> <FontAwesomeIcon icon={isProcessing ? faSpinner : faBroom} spin={isProcessing} /> Purgar </button>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                         <input type="text" placeholder="Buscar por nome ou descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md shadow-sm lg:col-span-2"/>
                         <select value={originFilter} onChange={e => setOriginFilter(e.target.value)} className="p-2 border rounded-md shadow-sm">
                             <option value="">Todas as Origens</option>
                             {uniqueOrigins.map(origin => <option key={origin} value={origin}>{origin || 'Importado'}</option>)}
                         </select>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                         <div> <label className="text-xs font-medium">De:</label> <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md shadow-sm w-full"/> </div>
                         <div> <label className="text-xs font-medium">Até:</label> <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md shadow-sm w-full"/> </div>
                         <div className="lg:col-span-2 flex justify-end"> <button onClick={clearFilters} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md shadow-sm hover:bg-gray-300 w-full md:w-auto"> Limpar Filtros </button> </div>
                     </div>
                </div>
                
                {message && <p className="text-center p-2 bg-green-50 text-green-700 rounded-md text-sm">{message}</p>}

                <div className="border rounded-lg overflow-hidden">
                     <div className="bg-gray-50 grid grid-cols-12 px-6 py-2">
                         <button onClick={() => requestSort('Origem')} className="col-span-2 text-left text-xs font-bold text-gray-600 uppercase flex items-center gap-2"> Origem <FontAwesomeIcon icon={getSortIcon('Origem')} /> </button>
                         <button onClick={() => requestSort('nome')} className="col-span-5 text-left text-xs font-bold text-gray-600 uppercase flex items-center gap-2"> Nome <FontAwesomeIcon icon={getSortIcon('nome')} /> </button>
                         <button onClick={() => requestSort('classificacao')} className="col-span-2 text-left text-xs font-bold text-gray-600 uppercase flex items-center gap-2"> Classificação <FontAwesomeIcon icon={getSortIcon('classificacao')} /> </button>
                         <button onClick={() => requestSort('created_at')} className="col-span-2 text-left text-xs font-bold text-gray-600 uppercase flex items-center gap-2"> Data de Criação <FontAwesomeIcon icon={getSortIcon('created_at')} /> </button>
                         <div className="col-span-1 text-center text-xs font-bold text-gray-600 uppercase">Ações</div>
                     </div>
                     <ul className="divide-y divide-gray-200">
                         {processedMaterials.length > 0 ? (
                             processedMaterials.map((material) => (
                                 <li key={material.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-gray-50">
                                     <div className="col-span-2 text-sm text-gray-700">{material.Origem || 'Importado'}</div>
                                     <div className="col-span-5 text-sm font-medium text-gray-900">{material.nome || material.descricao}</div>
                                     <div className="col-span-2 text-sm">
                                         <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                             material.classificacao === 'Equipamento' 
                                             ? 'bg-orange-100 text-orange-800' 
                                             : 'bg-teal-100 text-teal-800'
                                         }`}>
                                             {material.classificacao}
                                         </span>
                                     </div>
                                     <div className="col-span-2 text-sm text-gray-700">{formatDate(material.created_at)}</div>
                                     <div className="col-span-1 text-center space-x-4">
                                         <button onClick={() => handleOpenEditModal(material)} title="Editar" className="text-blue-500 hover:text-blue-700"> <FontAwesomeIcon icon={faEdit} /> </button>
                                         <button onClick={() => handleDelete(material.id)} title="Excluir" className="text-red-500 hover:text-red-700"> <FontAwesomeIcon icon={faTrash} /> </button>
                                     </div>
                                 </li>
                             ))
                         ) : ( <li className="text-center py-10 text-gray-500">Nenhum material encontrado com os filtros aplicados.</li> )}
                     </ul>
                </div>
            </div>
        </>
    );
}