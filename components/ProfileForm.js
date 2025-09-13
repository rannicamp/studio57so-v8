//components/ProfileForm.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function ProfileForm({ userData }) {
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState(userData?.nome || '');
  const [sobrenome, setSobrenome] = useState(userData?.sobrenome || '');
  const [avatarUrl, setAvatarUrl] = useState(userData?.avatar_url || null);
  
  useEffect(() => {
    setNome(userData?.nome || '');
    setSobrenome(userData?.sobrenome || '');
    setAvatarUrl(userData?.avatar_url || null);
  }, [userData]);

  const uploadAvatarMutation = useMutation({
    mutationFn: async (event) => {
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você precisa selecionar uma imagem para fazer o upload.');
      }
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (!data.publicUrl) throw new Error("Não foi possível gerar a URL da imagem.");
      
      return data.publicUrl;
    },
    onSuccess: (newAvatarUrl) => {
      setAvatarUrl(newAvatarUrl);
      toast.info('Foto carregada! Clique em "Salvar Alterações" para confirmar.');
    },
    onError: (error) => {
      toast.error(`Erro ao carregar a foto: ${error.message}`);
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ nome, sobrenome, avatarUrl }) => {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nome,
          sobrenome,
          avatar_url: avatarUrl,
          updated_at: new Date(),
        })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userData', user.id] });
      // A linha abaixo força o recarregamento para atualizar componentes
      // como o Header, que dependem diretamente dos dados do usuário.
      window.location.reload();
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    toast.promise(updateProfileMutation.mutateAsync({ nome, sobrenome, avatarUrl }), {
      loading: 'Salvando perfil...',
      success: 'Perfil atualizado com sucesso! A página será recarregada.',
      error: (err) => `Erro ao salvar: ${err.message}`,
    });
  };

  const isProcessing = uploadAvatarMutation.isPending || updateProfileMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-6">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover" />
        ) : (
          <FontAwesomeIcon icon={faUserCircle} className="w-24 h-24 text-gray-300" />
        )}
        <div>
          <label htmlFor="photo-upload" className="cursor-pointer bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold text-sm">
            {uploadAvatarMutation.isPending ? 'Carregando...' : 'Carregar Nova Foto'}
          </label>
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            onChange={(e) => uploadAvatarMutation.mutate(e)}
            disabled={isProcessing}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF até 2MB.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nome" className="block text-sm font-medium">Nome</label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label htmlFor="sobrenome" className="block text-sm font-medium">Sobrenome</label>
          <input
            id="sobrenome"
            type="text"
            value={sobrenome}
            onChange={(e) => setSobrenome(e.target.value)}
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input id="email" type="text" value={user?.email} disabled className="mt-1 w-full p-2 border bg-gray-100 rounded-md cursor-not-allowed" />
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
         <button type="submit" disabled={isProcessing} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
            {isProcessing && <FontAwesomeIcon icon={faSpinner} spin />}
            {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}