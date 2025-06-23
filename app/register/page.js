"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../utils/supabase/client';

export default function RegisterPage() {
  const [nome, setNome] = useState(''); // Novo estado para o nome
  const [sobrenome, setSobrenome] = useState(''); // Novo estado para o sobrenome
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    // Enviando nome e sobrenome junto com o cadastro
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome: nome,
          sobrenome: sobrenome,
        }
      }
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="mb-8 flex justify-center">
            <img src={logoUrl} alt="Logo da Empresa" className="h-14 w-auto" />
          </div>
          
          <h2 className="mb-6 text-center text-2xl text-gray-900 font-khand uppercase font-light tracking-widest">
            Criar uma nova conta
          </h2>
          <form onSubmit={handleSignUp} className="space-y-4"> {/* Diminuído o space-y para caber mais campos */}
            
            {/* Novos campos de Nome e Sobrenome */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome</label>
                <input id="nome" type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
              </div>
              <div>
                <label htmlFor="sobrenome" className="block text-sm font-medium text-gray-700">Sobrenome</label>
                <input id="sobrenome" type="text" required value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
            </div>

            <div>
              <label htmlFor="confirm-password" aclass="block text-sm font-medium text-gray-700">Confirmar Senha</label>
              <input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
            </div>
            
            {error && <p className="text-sm text-red-600 text-center pt-2">{error}</p>}
            {message && <p className="text-sm text-green-600 text-center pt-2">{message}</p>}

            <div className="pt-2">
              <button type="submit" className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
                Cadastrar
              </button>
            </div>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          Já tem uma conta?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Faça o login
          </Link>
        </p>
      </div>
    </div>
  );
}