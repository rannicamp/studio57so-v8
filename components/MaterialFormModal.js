"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function MaterialFormModal({ isOpen, onClose, onSave, materialToEdit }) {
  const isEditing = Boolean(materialToEdit);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Se estiver editando, preenche o formulário com os dados do material.
      // Se não, inicia com o formulário em branco.
      setFormData(isEditing ? materialToEdit : {
        descricao: '',
        unidade_medida: 'unid.',
        preco_unitario: '',
        Grupo: 'Outros'
      });
    }
  }, [isOpen, materialToEdit, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(formData);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h3 className="text-xl font-bold mb-4">
          {isEditing ? 'Editar Material' : 'Adicionar Novo Material'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Descrição *</label>
            <input
              type="text"
              name="descricao"
              value={formData.descricao || ''}
              onChange={handleChange}
              required
              className="mt-1 w-full p-2 border rounded-md"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium">Unidade de Medida</label>
                <input type="text" name="unidade_medida" value={formData.unidade_medida || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium">Preço Unitário</label>
              <input
                type="number"
                name="preco_unitario"
                step="0.01"
                value={formData.preco_unitario || ''}
                onChange={handleChange}
                className="mt-1 w-full p-2 border rounded-md"
                placeholder="Ex: 123.45"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Grupo</label>
            <input type="text" name="Grupo" value={formData.Grupo || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
              {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}