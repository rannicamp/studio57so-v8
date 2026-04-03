import { faArrowDown, faArrowUp, faReceipt, faCalendarAlt, faRetweet, faExchangeAlt } from '@fortawesome/free-solid-svg-icons';
import { TipoToggleButton } from './TipoToggleButton';

export default function TipoLancamentoSelector({ formData, handleChange, isEditing }) {
 return (
 <div className="flex flex-col md:flex-row gap-6 p-2 bg-gray-100 rounded-lg">
 <div className="flex-1 space-y-2">
 <label className="text-sm font-semibold text-center text-gray-600 block">Natureza</label>
 <div className="flex gap-2">
 <TipoToggleButton label="Despesa" icon={faArrowDown} isActive={formData.tipo === 'Despesa' && formData.form_type !== 'transferencia'} onClick={() => { if (isEditing) return; handleChange({ target: { name: 'tipo', value: 'Despesa' } }) }} colorClass="bg-red-500 hover:bg-red-600" />
 <TipoToggleButton label="Receita" icon={faArrowUp} isActive={formData.tipo === 'Receita' && formData.form_type !== 'transferencia'} onClick={() => { if (isEditing) return; handleChange({ target: { name: 'tipo', value: 'Receita' } }) }} colorClass="bg-green-500 hover:bg-green-600" />
 </div>
 </div>
 {!isEditing && (
 <div className="flex-1 space-y-2">
 <label className="text-sm font-semibold text-center text-gray-600 block">Estrutura</label>
 <div className="flex gap-2">
 <TipoToggleButton label="Simples" icon={faReceipt} isActive={formData.form_type === 'simples'} onClick={() => handleChange({ target: { name: 'form_type', value: 'simples' } })} />
 <TipoToggleButton label="Parcelado" icon={faCalendarAlt} isActive={formData.form_type === 'parcelado'} onClick={() => handleChange({ target: { name: 'form_type', value: 'parcelado' } })} />
 <TipoToggleButton label="Recorrente" icon={faRetweet} isActive={formData.form_type === 'recorrente'} onClick={() => handleChange({ target: { name: 'form_type', value: 'recorrente' } })} />
 <TipoToggleButton label="Transferência" icon={faExchangeAlt} isActive={formData.form_type === 'transferencia'} onClick={() => handleChange({ target: { name: 'form_type', value: 'transferencia' } })} colorClass="bg-yellow-500 hover:bg-yellow-600 text-gray-800" />
 </div>
 </div>
 )}
 </div>
 );
}
