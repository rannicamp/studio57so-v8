// components/atividades/AtividadeFiltros.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faFilter, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown'; // Reutilizando seu componente existente

export default function AtividadeFiltros({ filters, onChange, onClear, listas }) {
    const { funcionarios = [], allEmpresas = [], empreendimentos = [] } = listas;

    // Opções de Status (Hardcoded ou vindas de prop se preferir)
    const statusOptions = [
        { id: 'Não Iniciado', text: 'Não Iniciado' },
        { id: 'Em Andamento', text: 'Em Andamento' },
        { id: 'Concluído', text: 'Concluído' },
        { id: 'Pausado', text: 'Pausado' },
        { id: 'Aguardando Material', text: 'Aguardando Material' },
        { id: 'Cancelado', text: 'Cancelado' }
    ];

    return (
        <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-100">
            {/* CABEÇALHO E BUSCA TEXTUAL */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por nome, ID (#123) ou atividade pai..."
                        className="pl-10 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                        value={filters.searchTerm || ''}
                        onChange={(e) => onChange('searchTerm', e.target.value)}
                    />
                </div>
                <button 
                    onClick={onClear}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 justify-center whitespace-nowrap"
                >
                    <FontAwesomeIcon icon={faTimes} /> Limpar Filtros
                </button>
            </div>

            {/* GRID DE FILTROS AVANÇADOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                
                {/* Filtro de Empresa */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Empresa</label>
                    <select 
                        value={filters.empresa || ''} 
                        onChange={e => onChange('empresa', e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm bg-gray-50 focus:bg-white"
                    >
                        <option value="">Todas as Empresas</option>
                        {allEmpresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                    </select>
                </div>

                {/* Filtro de Empreendimento (Dependente da Empresa) */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Empreendimento</label>
                    <select 
                        value={filters.empreendimento || ''} 
                        onChange={e => onChange('empreendimento', e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm bg-gray-50 focus:bg-white"
                        disabled={!filters.empresa && empreendimentos.length > 50} // Opcional: Desabilita se tiver muitos sem filtro
                    >
                        <option value="">Todos os Empreendimentos</option>
                        {empreendimentos
                            .filter(e => !filters.empresa || e.empresa_proprietaria_id == filters.empresa)
                            .map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                </div>

                {/* Filtro de Responsável */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Responsável</label>
                    <select 
                        value={filters.responsavel || ''} 
                        onChange={e => onChange('responsavel', e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm bg-gray-50 focus:bg-white"
                    >
                        <option value="">Todos</option>
                        {funcionarios.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
                    </select>
                </div>

                {/* Filtro de Status (MultiSelect) */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                    <div className="h-[38px]"> {/* Altura fixa para alinhar com os selects padrão */}
                        <MultiSelectDropdown
                            options={statusOptions}
                            selectedIds={filters.status} 
                            onChange={(selected) => onChange('status', selected)}
                            placeholder="Filtrar Status..."
                        />
                    </div>
                </div>

                {/* Filtro de Data (Intervalo) */}
                <div className="lg:col-span-1 flex gap-2">
                    <div className="space-y-1 w-1/2">
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                            <FontAwesomeIcon icon={faCalendarAlt} /> De
                        </label>
                        <input
                            type="date"
                            value={filters.startDate || ''}
                            onChange={e => onChange('startDate', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm bg-gray-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1 w-1/2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Até</label>
                        <input
                            type="date"
                            value={filters.endDate || ''}
                            onChange={e => onChange('endDate', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm bg-gray-50 focus:bg-white"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}