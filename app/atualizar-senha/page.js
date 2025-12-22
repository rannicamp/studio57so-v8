// Caminho: app/atualizar-senha/page.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faSpinner, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function AtualizarSenhaPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // --- NOVA LOGO ATUALIZADA ---
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/LOGO-P_1765565958716.PNG";

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Link inválido ou expirado.", {
            description: "Por favor, solicite uma nova recuperação de senha."
        });
        setTimeout(() => router.push('/recuperar-senha'), 3000);
      }
    };
    checkSession();
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

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error("Erro ao atualizar senha:", error);
      toast.error("Erro ao atualizar", { description: error.message });
      setIsLoading(false);
    } else {
      toast.success("Senha atualizada!", { description: "Você já pode acessar o sistema." });
      
      setTimeout(() => {
          router.push('/painel'); 
      }, 1500);
    }
  };

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