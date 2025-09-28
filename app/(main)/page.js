// Caminho do arquivo: app/page.js

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
    weight: ['400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
});

export default function HomePage() {
  return (
    <div className={`${roboto.className} bg-white text-gray-800 font-sans`}>
        {/* Header com o botão de Login */}
        <header className="absolute top-0 left-0 right-0 z-40 p-4">
            <div className="container mx-auto flex justify-between items-center">
                {/* Logo da sua empresa - ajuste a URL se necessário */}
                <Image
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marcas/studiologo-preto.png"
                    alt="Logo Studio 57"
                    width={150}
                    height={50}
                    className="object-contain"
                />
                <Link href="/login">
                    <div className="bg-blue-600 text-white font-bold py-2 px-6 rounded-full hover:bg-blue-700 transition-colors duration-300 shadow-lg">
                        Login
                    </div>
                </Link>
            </div>
        </header>

        {/* Seção Principal (Hero) */}
        <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
            <div
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{
                    backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/capa%20vazia2.png')",
                }}
            ></div>
            <div className="absolute inset-0 bg-black opacity-40 z-10"></div>
            
            <div className="relative z-30 flex flex-col items-center p-4 w-full text-center">
                <div className="max-w-3xl">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                        Bem-vindo ao Studio 57
                    </h1>
                    <p className="text-lg md:text-xl text-gray-200" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}>
                        Sua plataforma completa para gestão de empreendimentos, finanças e clientes.
                    </p>
                </div>
            </div>
        </section>

        {/* Rodapé Simples */}
        <footer className="bg-gray-800 text-white py-4">
            <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
                <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
            </div>
        </footer>
    </div>
  );
}