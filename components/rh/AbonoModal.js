// components/AbonoModal.js

"use client";

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // <--- 1. IMPORTAMOS O 'useAuth'
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner'; // <-- Importa o toast para notificações
import UppyListUploader from '../ui/UppyListUploader';

export default function AbonoModal({ isOpen, onClose, onSave, date, employeeId }) {
 const supabase = createClient();
 const { userData } = useAuth(); // <--- 2. PEGAMOS OS DADOS DO USUÁRIO LOGADO
 const [horas, setHoras] = useState(8);
 const [motivo, setMotivo] = useState('');
 const [uploadedFilePath, setUploadedFilePath] = useState(null);
 const [loading, setLoading] = useState(false);

 const handleSave = async () => {
 setLoading(true);

 // ---> 3. AQUI ESTÁ A MUDANÇA MÁGICA <---
 // Verificação de segurança para garantir que temos a organização
 if (!userData?.organizacao_id) {
 toast.error('Erro de segurança: Organização do usuário não encontrada. Por favor, faça login novamente.');
 setLoading(false);
 return;
 }

 // Adicionamos o "carimbo" da organização ao pacote de dados
 await onSave({
 data_abono: date,
 horas_abonadas: horas,
 motivo: motivo,
 caminho_arquivo: uploadedFilePath,
 organizacao_id: userData.organizacao_id, // <-- "Carimbo" adicionado!
 });

 setLoading(false);
 onClose();
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
 <h3 className="text-xl font-bold mb-4">Abonar Horas para {new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR')}</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium">Horas a Abonar *</label>
 <input
 type="number"
 step="0.5"
 value={horas}
 onChange={(e) => setHoras(parseFloat(e.target.value))}
 required
 className="mt-1 w-full p-2 border rounded-md"
 />
 </div>
 <div>
 <label className="block text-sm font-medium">Motivo (Ex: Atestado Médico) *</label>
 <textarea
 value={motivo}
 onChange={(e) => setMotivo(e.target.value)}
 required
 rows="3"
 className="mt-1 w-full p-2 border rounded-md"
 ></textarea>
 </div>
 <div>
 <label className="block text-sm font-medium mb-1">Anexar Atestado (Opcional)</label>
 {!uploadedFilePath ? (
 <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 max-h-[400px]">
 <UppyListUploader
 bucketName="funcionarios-documentos"
 folderPath={`documentos/${employeeId}`}
 maxNumberOfFiles={1}
 hideClassificacao={true}
 onUploadSuccess={(result) => setUploadedFilePath(result.path)}
 />
 </div>
 ) : (
 <div className="flex items-center justify-between p-3 bg-green-50 text-green-700 border border-green-200 rounded-md">
 <span className="text-sm">Atestado anexado com sucesso!</span>
 <button type="button" onClick={() => setUploadedFilePath(null)} className="text-sm font-medium underline text-red-600 hover:text-red-800">
 Remover
 </button>
 </div>
 )}
 </div>
 </div>
 <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
 <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
 <button onClick={handleSave} disabled={loading || !motivo} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
 {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Abono'}
 </button>
 </div>
 </div>
 </div>
 );
}