import { toast } from 'sonner';

export const UpdateScopeToast = ({ t, onSingle, onFuture }) => (
 <div className="w-full bg-white p-1 rounded">
 <p className="font-bold text-gray-800 mb-1">Edição de Série/Parcelamento</p>
 <p className="text-sm text-gray-600 mb-3">Como deseja aplicar estas alterações?</p>
 <div className="flex gap-2">
 <button
 onClick={() => { toast.dismiss(t); onSingle(); }}
 className="flex-1 text-sm font-semibold px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
 >
 Apenas Esta
 </button>
 <button
 onClick={() => { toast.dismiss(t); onFuture(); }}
 className="flex-1 text-sm font-semibold px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
 >
 Esta e Futuras
 </button>
 </div>
 </div>
);
