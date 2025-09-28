// Caminho: app/login/page.js
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../utils/supabase/client';
// O PORQUÊ DESTA IMPORTAÇÃO: Adicionamos o componente otimizado de Imagem do Next.js
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const router = useRouter();
  const supabase = createClient();

  // O PORQUÊ DESTA MUDANÇA: Usando a logo oficial e pública para consistência.
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/logo/logo-studio57-preto.png";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      // O PORQUÊ DESTA MUDANÇA (CORREÇÃO CRÍTICA):
      // Após o login, o usuário deve ser levado para o painel interno (/painel),
      // e não para a nova home page pública (/).
      router.push('/painel');
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="mb-8 flex justify-center">
            {/* O PORQUÊ DESTA MUDANÇA: Trocamos <img> por <Image> para otimização. */}
            <Image src={logoUrl} alt="Logo Studio 57" width={180} height={40} priority />
          </div>

          <h2 className="mb-6 text-center text-2xl text-gray-900 font-khand uppercase font-light tracking-widest">
            Acessar sua conta
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password"className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Entrar
              </button>
            </div>
          </form>
        </div>
        
        {/* O PORQUÊ DESTA MUDANÇA (SUA SOLICITAÇÃO):
            O bloco de código abaixo, que continha o link para a página de registro, foi completamente removido. */}
            
      </div>
    </div>
  );
}