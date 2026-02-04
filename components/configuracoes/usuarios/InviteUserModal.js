// Caminho: components/configuracoes/usuarios/InviteUserModal.js
'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faUserPlus, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { inviteUser } from '@/app/(main)/configuracoes/usuarios/inviteAction'; 
import { useAuth } from '@/contexts/AuthContext';

export default function InviteUserModal({ isOpen, onClose, cargos = [], onSuccess }) {
  const { organizacao_id } = useAuth();
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    email: '',
    cargoId: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!formData.cargoId) {
      toast.error("Selecione um cargo para o usuário.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await inviteUser({
        ...formData,
        organizacaoId: organizacao_id
      });

      if (result.success) {
        toast.success(result.message);
        setFormData({ nome: '', sobrenome: '', email: '', cargoId: '' }); // Limpa form
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error("Erro ao convidar: " + result.error);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro inesperado ao processar convite.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-gray-900 flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <FontAwesomeIcon icon={faUserPlus} className="text-blue-600" />
                    </div>
                    Convidar Novo Usuário
                  </Dialog.Title>
                  <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nome *</label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({...formData, nome: e.target.value})}
                        className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="Ex: João"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Sobrenome</label>
                      <input
                        type="text"
                        value={formData.sobrenome}
                        onChange={(e) => setFormData({...formData, sobrenome: e.target.value})}
                        className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="Ex: Silva"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">E-mail Corporativo *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FontAwesomeIcon icon={faEnvelope} className="text-gray-400 text-xs" />
                      </div>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full rounded-lg border-gray-300 border p-2 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="joao.projetista@studio57.com"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">O convite será enviado para este endereço.</p>
                  </div>

                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                    <label className="block text-xs font-bold text-yellow-800 mb-1">Cargo / Função *</label>
                    <select
                      required
                      value={formData.cargoId}
                      onChange={(e) => setFormData({...formData, cargoId: e.target.value})}
                      className="w-full rounded-lg border-yellow-200 bg-white p-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
                    >
                      <option value="">Selecione o cargo...</option>
                      {cargos.map(cargo => (
                        <option key={cargo.id} value={cargo.id}>
                          {cargo.nome_funcao}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-yellow-600 mt-1">
                      ⚠️ O usuário já será criado com este perfil de acesso.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin /> Enviando...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faEnvelope} /> Enviar Convite
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}