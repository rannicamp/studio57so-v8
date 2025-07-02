"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function AbonoModal({ isOpen, onClose, onSave, date }) {
  const [horas, setHoras] = useState(8);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave({
      data_abono: date,
      horas_abonadas: horas,
      motivo: motivo
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