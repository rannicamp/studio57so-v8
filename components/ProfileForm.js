"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function ProfileForm({ userData }) {
  const supabase = createClient();
  const { user } = useAuth(); // Pega o usuário do contexto de autenticação

  const [nome, setNome] = useState(userData?.nome || '');
  const [sobrenome, setSobrenome] = useState(userData?.sobrenome || '');
  const [avatarUrl, setAvatarUrl] = useState(userData?.avatar_url || null);
  
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  // Atualiza o formulário se os dados do userData mudarem
  useEffect(() => {
    setNome(userData?.nome || '');
    setSobrenome(userData?.sobrenome || '');
    setAvatarUrl(userData?.avatar_url || null);
  }, [userData]);
  
  async function uploadAvatar(event) {
    try {
      setUploading(true);
      setMessage('');

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você precisa selecionar uma imagem para fazer o upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Pega a URL pública
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      if (!data.publicUrl) {
          throw new Error("Não foi possível gerar a URL pública da imagem.");
      }
      
      setAvatarUrl(data.publicUrl);
      
      setMessage('Foto carregada! Clique em "Salvar" para confirmar.');

    } catch (error) {
      setMessage(`Erro ao carregar a foto: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setUploading(true);
    setMessage('Salvando perfil...');

    const { error } = await supabase
      .from('usuarios')
      .update({
        nome: nome,
        sobrenome: sobrenome,
        avatar_url: avatarUrl,
        updated_at: new Date(),
      })
      .eq('id', user.id);

    if (error) {
      setMessage(`Erro ao salvar o perfil: ${error.message}`);
    } else {
      setMessage('Perfil atualizado com sucesso!');
      // Recarregar a página para que o Header e outros componentes atualizem
      window.location.reload();
    }
    setUploading(false);
  }

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
            {uploading ? 'Carregando...' : 'Carregar Nova Foto'}
          </label>
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            onChange={uploadAvatar}
            disabled={uploading}
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
         {message && <p className="text-sm font-medium text-gray-600 self-center">{message}</p>}
         <button type="submit" disabled={uploading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
            {uploading && <FontAwesomeIcon icon={faSpinner} spin />}
            {uploading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}