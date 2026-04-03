import { IMaskInput } from 'react-imask';

export default function FormValoresEDatas({ formData, handleChange, handleValorChange, isEditing }) {
 const isTransferencia = formData.form_type === 'transferencia';
 const isSimples = formData.form_type === 'simples';

 return (
 <>
 <div className="space-y-4 pt-4 border-t mt-4">
 <input type="text" name="descricao" value={formData.descricao || ''} onChange={handleChange} required placeholder="Descrição do Lançamento *" className="w-full p-2 border rounded-md" />
 </div>

 {(isSimples || isTransferencia || isEditing) && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
 <div>
 <label className="block text-sm font-medium">Valor *</label>
 <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] } }} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleValorChange(v)} required className="w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">{isTransferencia ? 'Data Transferência *' : 'Data Transação *'}</label>
 <input type="date" name="data_transacao" value={formData.data_transacao || ''} onChange={handleChange} required className="w-full p-2 border rounded-md" />
 </div>
 </div>
 )}

 {(isSimples || isEditing) && (
 <div className="grid grid-cols-1 mt-4">
 <div>
 <label className="block text-sm font-medium">Data de Vencimento *</label>
 <input type="date" name="data_vencimento" value={formData.data_vencimento || ''} onChange={handleChange} required className="w-full p-2 border rounded-md bg-yellow-50" />
 <p className="text-xs text-gray-500 mt-1">Data prevista para o débito.</p>
 </div>
 </div>
 )}
 </>
 );
}
