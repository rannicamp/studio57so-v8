// Caminho: components/atividades/form/ActivityAssignment.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faTrafficLight } from '@fortawesome/free-solid-svg-icons';

export default function ActivityAssignment({ formData, setFormData, funcionarios }) {

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'Não Iniciado': return 'text-gray-500';
            case 'Em Andamento': return 'text-blue-600';
            case 'Concluído': return 'text-green-600';
            case 'Pausado': return 'text-orange-500';
            case 'Atrasado': return 'text-red-600';
            case 'Cancelado': return 'text-gray-400 decoration-line-through';
            default: return 'text-gray-700';
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm space-y-5">
            
            {/* Responsável */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faUser} className="text-gray-400 text-xs" />
                    <label className="block text-xs font-bold text-gray-500 uppercase">Responsável</label>
                </div>
                <select 
                    name="funcionario_id" 
                    value={formData.funcionario_id || ''} 
                    onChange={handleChange} 
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value="">-- Ninguém --</option>
                    {funcionarios?.map(func => (
                        <option key={func.id} value={func.id}>
                            {/* Aqui usamos full_name conforme sua tabela */}
                            {func.full_name} 
                        </option>
                    ))}
                </select>
            </div>

            {/* Status */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faTrafficLight} className="text-gray-400 text-xs" />
                    <label className="block text-xs font-bold text-gray-500 uppercase">Status Atual</label>
                </div>
                <div className="relative">
                    <select 
                        name="status" 
                        value={formData.status} 
                        onChange={handleChange} 
                        className={`w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-semibold ${getStatusColor(formData.status)}`}
                    >
                        <option value="Não Iniciado" className="text-gray-500">⚪ Não Iniciado</option>
                        <option value="Em Andamento" className="text-blue-600">🔵 Em Andamento</option>
                        <option value="Aguardando Material" className="text-purple-600">🟣 Aguardando Material</option>
                        <option value="Pausado" className="text-orange-500">🟠 Pausado</option>
                        <option value="Concluído" className="text-green-600">🟢 Concluído</option>
                        <option value="Cancelado" className="text-gray-400">⚫ Cancelado</option>
                    </select>
                </div>
            </div>

        </div>
    );
}