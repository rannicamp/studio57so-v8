// Caminho: app/atualizar-senha/page.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faSpinner, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { updatePasswordAction } from './actions';

export default function AtualizarSenhaPage() {
 const [password, setPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [isLoading, setIsLoading] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // --- NOVA LOGO ATUALIZADA ---
  const logoUrl = "/marca/logo-elo57-horizontal.svg";

  useEffect(() => {
    let sessionEstablished = false;

    // 1. Escuta mudanças de estado (Supabase trata a hash da URL de forma assíncrona)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Atualizar Senha] Evento de Auth:", event, !!session);
      if (session) {
        sessionEstablished = true;
        setVerificando(false);
      }
    });

    // 2. Aguarda um pequeno delay de 1.5s para dar tempo ao SDK de processar os tokens da URL.
    // Se após esse delay ainda não houver sessão ativa, aí sim tratamos o link como inválido.
    const checkTimeout = setTimeout(async () => {
      if (sessionEstablished) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Link inválido ou expirado.", {
          description: "Por favor, solicite uma nova recuperação de senha."
        });
        router.push('/recuperar-senha');
      } else {
        setVerificando(false);
      }
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(checkTimeout);
    };
  }, [supabase, router]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Erro de validação", { description: "As senhas não coincidem." });
      return;
    }

    if (password.length < 6) {
      toast.error("Senha muito curta", { description: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }

    setIsLoading(true);

    try {
      const response = await updatePasswordAction(password);

      if (response?.error) {
        toast.error("Erro ao atualizar", { description: response.error });
        setIsLoading(false);
      } else {
        toast.success("Senha atualizada!", { description: "Você já pode acessar o sistema." });
        setTimeout(() => {
          router.push('/painel');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão", { description: "Não foi possível comunicar o servidor." });
      setIsLoading(false);
    }
  };

  if (verificando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600 font-medium">Verificando link de segurança...</p>
        </div>
      </div>
    );
  }

  return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
 <div className="w-full max-w-md">
 <div className="bg-white p-8 rounded-lg shadow-md">
 <div className="mb-8 flex justify-center">
 <Image src={logoUrl} alt="Logo Studio 57" width={200} height={60} priority className="object-contain" />
 </div>

 <h2 className="mb-6 text-center text-2xl text-gray-900 font-khand uppercase font-light tracking-widest">
 Definir Nova Senha
 </h2>

 <form onSubmit={handleUpdatePassword} className="space-y-6">
 <div>
 <label htmlFor="password" className="block text-sm font-medium text-gray-700">
 Nova Senha
 </label>
 <div className="mt-1 relative rounded-md shadow-sm">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faLock} className="text-gray-400" />
 </div>
 <input
 id="password"
 name="password"
 type="password"
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="block w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
 placeholder="******"
 />
 </div>
 </div>

 <div>
 <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
 Confirmar Nova Senha
 </label>
 <div className="mt-1 relative rounded-md shadow-sm">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faCheckCircle} className="text-gray-400" />
 </div>
 <input
 id="confirmPassword"
 name="confirmPassword"
 type="password"
 required
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 className="block w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
 placeholder="******"
 />
 </div>
 </div>

 <div>
 <button
 type="submit"
 disabled={isLoading}
 className="flex w-full justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-70"
 >
 {isLoading ? (
 <>
 <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
 Salvando...
 </>
 ) : (
 "Salvar Nova Senha"
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}