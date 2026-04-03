import { IMaskInput } from 'react-imask';

export default function FormRecorrente({ formData, handleChange, handleValorChange, isEditing }) {
 if (formData.form_type !== 'recorrente' || isEditing) return null;

 return (
 <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in mt-4">
 <legend className="font-semibold text-sm">Detalhes da Recorrência</legend>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
 <div>
 <label className="block text-sm font-medium">Valor Parcela *</label>
 <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] } }} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleValorChange(v)} required className="w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">Data Contrato</label>
 <input type="date" name="data_transacao" value={formData.data_transacao || ''} onChange={handleChange} required className="w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">Data Início *</label>
 <input type="date" name="recorrencia_data_inicio" value={formData.recorrencia_data_inicio} onChange={handleChange} required className="w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">Data Fim</label>
 <input type="date" name="recorrencia_data_fim" value={formData.recorrencia_data_fim || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
 </div>
 </div>
 </fieldset>
 );
}
