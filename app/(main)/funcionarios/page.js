// app/(main)/funcionarios/page.js
// REDIRECIONAMENTO: Esta rota foi unificada com /recursos-humanos
import { redirect } from 'next/navigation';

export default function FuncionariosRedirectPage() {
 redirect('/recursos-humanos');
}