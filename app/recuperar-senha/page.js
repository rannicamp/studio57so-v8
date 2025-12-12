// Caminho: app/recuperar-senha/page.js
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowLeft, faSpinner, faRedo } from '@fortawesome/free-solid-svg-icons';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0); 
  
  const supabase = createClient();

  // --- NOVA LOGO ATUALIZADA ---
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/LOGO-P_1765565958716.PNG";

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRecover = async (e) => {
    if (e) e.preventDefault();
    if (countdown > 0) return;

    setIsLoading(true);

    const redirectUrl = `${window.location.origin}/atualizar-senha`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    setIsLoading(false);

    if (error) {
      console.error("Erro ao solicitar recuperação:", error);
      if (error.status === 429 || error.message.includes("rate limit")) {
          toast.error("Muitas tentativas", {
            description: "Aguarde 60 segundos antes de tentar novamente.",
          });
          setCountdown(60);
      } else {
          toast.error("Erro ao enviar email", {
            description: error.message || "Tente novamente mais tarde.",
          });
      }
    } else {
      setIsSuccess(true);
      setCountdown(60); 
      toast.success("E-mail enviado!", {
        description: "Verifique sua caixa de entrada (e spam).",
      });
    }
  };

  const handleResend = () => {
      handleRecover(null);
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md text-center">
            <div className="mb-6 flex justify-center">
                <Image src={logoUrl} alt="Logo Studio 57" width={160} height={50} priority className="object-contain" />
            </div>
            <div className="text-green-500 mb-4 text-5xl">
                <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Verifique seu e-mail</h2>
            <p className="text-gray-600 mb-6">
                Enviamos um link de recuperação para <strong>{email}</strong>. 
                Clique no link para criar uma nova senha.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-md mb-6 border border-gray-100">
                <p className="text-sm text-gray-500 mb-3">
                    Não recebeu o e-mail? Verifique sua caixa de Spam.
                </p>
                <button
                    onClick={handleResend}
                    disabled={countdown > 0 || isLoading}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center w-full"
                >
                    {isLoading ? (
                        <><FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> Enviando...</>
                    ) : countdown > 0 ? (
                        `Aguarde ${countdown}s para reenviar`
                    ) : (
                        <><FontAwesomeIcon icon={faRedo} className="mr-2"/> Reenviar e-mail</>
                    )}
                </button>
            </div>

            <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium block">
                <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
                Voltar para o Login
            </Link>
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
                  className="block w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="exemplo@studio57.com.br"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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
            <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
              <FontAwesomeIcon icon={faArrowLeft} className="mr-1" /> Voltar para o Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}