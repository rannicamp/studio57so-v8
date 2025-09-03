// app/(public)/layout.js

// O layout agora simplesmente passa os filhos adiante,
// deixando o layout principal (app/layout.js) cuidar do <html> e <body>.
// Isso resolve o erro de hidratação.
export default function PublicLayout({ children }) {
  return <>{children}</>;
}