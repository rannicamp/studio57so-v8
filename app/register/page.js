// app/register/page.js
"use client";

import Link from 'next/link';

export default function RegisterPage() {
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="mb-8 flex justify-center">
            <img src={logoUrl} alt="Logo da Empresa" className="h-14 w-auto" />
          </div>

          <h2 className="mb-4 text-2xl text-gray-900 font-khand uppercase font-light tracking-widest">
            Cadastro de Novos Usuários
          </h2>

          <p className="text-gray-600 mb-6">
            O cadastro de novas contas de usuário agora é realizado internamente por um administrador do sistema.
          </p>
          <p className="text-gray-600">
            Se você precisa de acesso, por favor, entre em contato com o proprietário da sua organização.
          </p>

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