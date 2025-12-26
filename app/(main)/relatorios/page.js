// app/(main)/relatorios/page.js
import { redirect } from 'next/navigation';

export default function RelatoriosPage() {
  // Redireciona para o primeiro relatório disponível
  redirect('/relatorios/rh');
}