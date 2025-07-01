"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFileImport, faFileExport, faBroom, faEdit, faTrash, faSort, faSortUp, faSortDown, faSpinner } from '@fortawesome/free-solid-svg-icons';

import MaterialFormModal from './MaterialFormModal';
import MaterialImporter from './materiais/MaterialImporter';

// Função para converter dados JSON em uma string CSV
function convertToCSV(data) {
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(';'), // Cabeçalho com ponto e vírgula
    ...data.map(row => 
      headers.map(fieldName => JSON.stringify(row[fieldName] || '', (key, value) => value === null ? '' : value)).join(';')
    )
  ];
  return csvRows.join('\r\n');
}


export default function MaterialManager({ initialMaterials }) {
  const supabase = createClient();
  const [materials, setMaterials] = useState(initialMaterials);
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // Estado para feedback de ações demoradas

  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'descricao', direction: 'ascending' });

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const uniqueOrigins = useMemo(() => {
    const origins = new Set(materials.map(m => m.Origem || 'Importado').filter(Boolean));
    return Array.from(origins).sort();
  }, [materials]);

  const processedMaterials = useMemo(() => {
    let filtered = [...materials];
    if (searchTerm) filtered = filtered.filter(mat => mat.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
    if (originFilter) { const filter = originFilter === 'Importado' ? null : originFilter; filtered = filtered.filter(mat => mat.Origem === filter || (!mat.Origem && filter === null)); }
    if (startDate) filtered = filtered.filter(mat => new Date(mat.created_at) >= new Date(startDate));
    if (endDate) filtered = filtered.filter(mat => new Date(mat.created_at) <= new Date(endDate + 'T23:59:59'));
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [materials, searchTerm, originFilter, startDate, endDate, sortConfig]);
  
  const requestSort = (key) => { let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending'; setSortConfig({ key, direction }); };
  const getSortIcon = (key) => { if (sortConfig.key !== key) return faSort; return sortConfig.direction === 'ascending' ? faSortUp : faSortDown; };
  const clearFilters = () => { setSearchTerm(''); setOriginFilter(''); setStartDate(''); setEndDate(''); setSortConfig({ key: 'descricao', direction: 'ascending' }); };
  const handleOpenAddModal = () => { setEditingMaterial(null); setIsFormModalOpen(true); };
  const handleOpenEditModal = (material) => { setEditingMaterial(material); setIsFormModalOpen(true); };
  
  const handleSaveMaterial = async (formData) => {
    const isEditing = Boolean(formData.id); let error;
    const dataToSave = { ...formData }; if (!isEditing) dataToSave.Origem = 'Manual';
    if (isEditing) {
      const { data, error: updateError } = await supabase.from('materiais').update(dataToSave).eq('id', formData.id).select().single();
      if (!updateError) setMaterials(prev => prev.map(m => m.id === data.id ? data : m)); error = updateError;
    } else {
      const { data, error: insertError } = await supabase.from('materiais').insert(dataToSave).select().single();
      if (!insertError) setMaterials(prev => [...prev, data]); error = insertError;
    }
    if (error) { alert(`Erro: ${error.message}`); } else { setMessage(`Material ${isEditing ? 'atualizado' : 'criado'}.`); setIsFormModalOpen(false); setTimeout(() => setMessage(''), 3000); }
  };
  
  const handleDelete = async (materialId) => {
    if (window.confirm('Tem certeza que deseja excluir este material?')) {
      const { error } = await supabase.from('materiais').delete().eq('id', materialId);
      if (error) { alert(`Erro: ${error.message}`); } else { setMaterials(prev => prev.filter(m => m.id !== materialId)); setMessage('Material excluído.'); setTimeout(() => setMessage(''), 3000); }
    }
  };
  
  const handleImportComplete = async () => {
    setIsImporterOpen(false);
    const { data: updatedMaterials } = await supabase.from('materiais').select('*').order('descricao');
    setMaterials(updatedMaterials || []);
  };
  
  // ***** INÍCIO DAS NOVAS FUNÇÕES *****
  const handleExport = async () => {
    setMessage('Exportando dados...');
    setIsProcessing(true);
    const { data, error } = await supabase.from('materiais').select('*').order('descricao');
    if (error) {
      alert('Erro ao exportar dados: ' + error.message);
      setMessage('');
      setIsProcessing(false);
      return;
    }
    const csvData = convertToCSV(data);
    const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'materiais_exportados.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMessage('Exportação concluída.');
    setIsProcessing(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const handlePurge = async () => {
    if (window.confirm('ATENÇÃO!\n\nVocê está prestes a excluir PERMANENTEMENTE todos os materiais que não estão sendo usados em NENHUM orçamento.\n\nEsta ação não pode ser desfeita. Deseja continuar?')) {
      setMessage('Purgando materiais não utilizados...');
      setIsProcessing(true);
      const { error, data } = await supabase.rpc('purgar_materiais_nao_utilizados');
      if (error) {
        alert('Erro ao purgar materiais: ' + error.message);
        setMessage('Erro ao purgar materiais.');
      } else {
        alert(`${data} materiais não utilizados foram excluídos com sucesso.`);
        setMessage(`${data} materiais purgados com sucesso!`);
        handleImportComplete(); // Re-busca a lista de materiais
      }
      setIsProcessing(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };
  // ***** FIM DAS NOVAS FUNÇÕES *****

  const formatDate = (dateString) => { if (!dateString) return 'N/A'; return new Date(dateString).toLocaleDateString('pt-BR'); };

  return (
    <>
      <MaterialFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSave={handleSaveMaterial} materialToEdit={editingMaterial} />
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
                <input type="text" placeholder="Buscar por descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md shadow-sm lg:col-span-2"/>
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
                <button onClick={() => requestSort('descricao')} className="col-span-7 text-left text-xs font-bold text-gray-600 uppercase flex items-center gap-2"> Descrição <FontAwesomeIcon icon={getSortIcon('descricao')} /> </button>
                <button onClick={() => requestSort('created_at')} className="col-span-2 text-left text-xs font-bold text-gray-600 uppercase flex items-center gap-2"> Data de Criação <FontAwesomeIcon icon={getSortIcon('created_at')} /> </button>
                <div className="col-span-1 text-center text-xs font-bold text-gray-600 uppercase">Ações</div>
            </div>
            <ul className="divide-y divide-gray-200">
                {processedMaterials.length > 0 ? (
                    processedMaterials.map((material) => (
                        <li key={material.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-gray-50">
                            <div className="col-span-2 text-sm text-gray-700">{material.Origem || 'Importado'}</div>
                            <div className="col-span-7 text-sm font-medium text-gray-900">{material.descricao}</div>
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