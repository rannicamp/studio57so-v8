import { IMaskInput } from 'react-imask';

export default function FormParcelado({ formData, handleChange, handleValorChange, isEditing }) {
 if (formData.form_type !== 'parcelado' || isEditing) return null;

 return (
 <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in mt-4">
 <legend className="font-semibold text-sm">Detalhes do Parcelamento</legend>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
 <div>
 <label className="block text-sm font-medium">Valor Total *</label>
 <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] } }} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleValorChange(v)} required className="w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">Data da Compra *</label>
 <input type="date" name="data_transacao" value={formData.data_transacao || ''} onChange={handleChange} required className="w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">Nº Parcelas *</label>
 <input type="number" min="2" name="numero_parcelas" value={formData.numero_parcelas} onChange={handleChange} required className="w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">1º Vencimento *</label>
 <input type="date" name="data_primeiro_vencimento" value={formData.data_primeiro_vencimento} onChange={handleChange} required className="w-full p-2 border rounded-md bg-yellow-50" />
 <p className="text-[10px] text-gray-500 mt-0.5">Calculado se for cartão.</p>
 </div>
 </div>
 </fieldset>
 );
}
