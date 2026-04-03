// Caminho: components/atividades/form/ActivityAssignment.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faTrafficLight } from '@fortawesome/free-solid-svg-icons';

export default function ActivityAssignment({ formData, setFormData, funcionarios }) {

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => ({ ...prev, [name]: value }));
 };

 const statusOptions = [
 { value: 'Não Iniciado', label: 'Não Iniciado', activeBg: 'bg-gray-100', activeBorder: 'border-gray-400', activeText: 'text-gray-700', ring: 'ring-gray-400', dot: 'bg-gray-400' },
 { value: 'Em Andamento', label: 'Em Andamento', activeBg: 'bg-blue-50', activeBorder: 'border-blue-500', activeText: 'text-blue-700', ring: 'ring-blue-500', dot: 'bg-blue-500' },
 { value: 'Aguardando Material', label: 'Aguardando Material', activeBg: 'bg-purple-50', activeBorder: 'border-purple-500', activeText: 'text-purple-700', ring: 'ring-purple-500', dot: 'bg-purple-500' },
 { value: 'Pausado', label: 'Pausado', activeBg: 'bg-blue-600', activeBorder: 'border-blue-600', activeText: 'text-blue-600', ring: 'ring-blue-600', dot: 'bg-blue-600' },
 { value: 'Concluído', label: 'Concluído', activeBg: 'bg-green-50', activeBorder: 'border-green-500', activeText: 'text-green-700', ring: 'ring-green-500', dot: 'bg-green-500' },
 { value: 'Cancelado', label: 'Cancelado', activeBg: 'bg-zinc-100', activeBorder: 'border-zinc-500', activeText: 'text-zinc-700', ring: 'ring-zinc-500', dot: 'bg-zinc-600' }
 ];

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
 <div className="grid grid-cols-2 gap-2 mt-1">
 {statusOptions.map((s) => {
 const isSelected = formData.status === s.value;
 return (
 <button
 key={s.value}
 type="button"
 onClick={() => setFormData(prev => ({ ...prev, status: s.value }))}
 className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-semibold text-left transition-all outline-none ${isSelected
 ? `${s.activeBg} ${s.activeBorder} ${s.activeText} ring-1 ${s.ring} shadow-sm`
 : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
 }`}
 >
 <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isSelected ? s.dot : 'bg-gray-300'}`}></span>
 <span className="leading-tight">{s.label}</span>
 </button>
 );
 })}
 </div>
 </div>

 </div>
 );
}