// Caminho: app/recuperar-senha/page.js
"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner'; // Usando a biblioteca de notificações que você já tem
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowLeft, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const supabase = createClient();

  // URL da logo (mesma do login para consistência)
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/logo/logo-studio57-preto.png";

  const handleRecover = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // O PORQUÊ: O redirecionamento precisa apontar para a página que vamos criar no próximo passo.
    // Usamos window.location.origin para pegar automaticamente "http://localhost:3000" ou seu domínio real.
    const redirectUrl = `${window.location.origin}/atualizar-senha`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    setIsLoading(false);

    if (error) {
      console.error("Erro ao solicitar recuperação:", error);
      toast.error("Erro ao enviar email", {
        description: error.message || "Tente novamente mais tarde.",
      });
    } else {
      setIsSuccess(true);
      toast.success("E-mail enviado!", {
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
    }
  };

  // Se deu certo, mostramos uma mensagem de sucesso amigável
  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md text-center">
            <div className="mb-6 flex justify-center">
                <Image src={logoUrl} alt="Logo Studio 57" width={140} height={30} priority />
            </div>
            <div className="text-green-500 mb-4 text-5xl">
                <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Verifique seu e-mail</h2>
            <p className="text-gray-600 mb-6">
                Enviamos um link de recuperação para <strong>{email}</strong>. 
                Clique no link para criar uma nova senha.
            </p>
            <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
                Voltar para o Login
            </Link>
        </div>
      </div>
    );
  }

  // Formulário Padrão
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="mb-8 flex justify-center">
            <Image src={logoUrl} alt="Logo Studio 57" width={180} height={40} priority />
          </div>

          <h2 className="mb-2 text-center text-2xl text-gray-900 font-khand uppercase font-light tracking-widest">
            Recuperar Senha
          </h2>
          <p className="mb-6 text-center text-sm text-gray-500">
            Digite seu e-mail e enviaremos um link para você redefinir sua senha.
          </p>

          <form onSubmit={handleRecover} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email cadastrado
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FontAwesomeIcon icon={faEnvelope} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="exemplo@studio57.com.br"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                    <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Enviando...
                    </>
                ) : (
                    "Enviar Link de Recuperação"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              <FontAwesomeIcon icon={faArrowLeft} className="mr-1" /> Voltar para o Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}