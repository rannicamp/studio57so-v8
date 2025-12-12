// Caminho: app/login/page.js
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // --- NOVA LOGO ATUALIZADA ---
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/LOGO-P_1765565958716.PNG";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.push('/painel');
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="mb-8 flex justify-center">
            {/* Ajustei o width/height para garantir que a proporção fique boa */}
            <Image 
                src={logoUrl} 
                alt="Logo Studio 57" 
                width={200} 
                height={60} 
                priority 
                className="object-contain" // Garante que a imagem não distorça
            />
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
              
              <div className="flex items-center justify-end mt-2">
                <div className="text-sm">
                  <Link 
                    href="/recuperar-senha" 
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Esqueceu sua senha?
                  </Link>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded border border-red-200">
                {error === "Invalid login credentials" ? "E-mail ou senha incorretos." : error}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}