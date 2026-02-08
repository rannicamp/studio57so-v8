// components/modals/ConfirmReadmissionModal.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faUserPlus } from '@fortawesome/free-solid-svg-icons';

export default function ConfirmReadmissionModal({ isOpen, onClose, onConfirm, funcionarioExistente }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all duration-300 ease-in-out scale-95 hover:scale-100">
        <div className="text-center">
            <FontAwesomeIcon icon={faUserPlus} className="text-5xl text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Readmitir Funcionário?</h2>
            <p className="text-gray-600 mb-6">
                O CPF informado já pertence a <strong className="font-semibold">{funcionarioExistente.full_name}</strong>, que foi demitido em <strong className="font-semibold">{new Date(funcionarioExistente.demission_date).toLocaleDateString('pt-BR')}</strong>.
            </p>
            <p className="text-sm bg-blue-50 text-blue-700 p-3 rounded-lg">
                Deseja criar um novo ciclo de trabalho para este funcionário?
            </p>
        </div>
        <div className="flex justify-center gap-4 mt-8">
          <button 
            onClick={onClose} 
            className="px-6 py-2 rounded-lg text-gray-800 bg-gray-200 hover:bg-gray-300 font-semibold transition-colors duration-200"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm} 
            className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 font-semibold transition-colors duration-200 flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faUserPlus} />
            Sim, Readmitir
          </button>
        </div>
      </div>
    </div>
  );
}