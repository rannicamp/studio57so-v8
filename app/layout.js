import './globals.css';
import Sidebar from '../components/sidebar';
import Header from '../components/Header';

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão de Obras',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">
        <div className="flex">
          <Sidebar />

          <div className="flex-1">
            <Header />

            <main className="ml-[260px] mt-[65px] p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}