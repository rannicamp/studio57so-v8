import './globals.css';

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão de Obras',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Adicionando as fontes do Google Fonts - AGORA COM O PESO 300 PARA KHAND */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Khand:wght@300;400;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}