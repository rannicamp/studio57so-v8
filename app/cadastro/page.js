// app/cadastro/page.js

'use client';

import { useState } from 'react';
import { signUpAction } from './actions';
import { useRouter } from 'next/navigation';

export default function CadastroPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const result = await signUpAction(formData);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
    } else {
      // Sucesso! Redireciona para o login ou para uma página de "verifique seu email"
      router.push('/login?message=Cadastro realizado com sucesso! Verifique seu e-mail para confirmar.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Criar Nova Conta</h2>
      <p>Cadastre sua organização e comece a gerenciar suas obras.</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="organizacao">Nome da Organização/Holding</label>
          <input type="text" id="organizacao" name="organizacao" required style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="nome">Seu Nome Completo</label>
          <input type="text" id="nome" name="nome" required style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="email">Seu E-mail</label>
          <input type="email" id="email" name="email" required style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="password">Sua Senha</label>
          <input type="password" id="password" name="password" required minLength="6" style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
        </div>
        
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {loading ? 'Cadastrando...' : 'Criar Conta'}
        </button>
      </form>
    </div>
  );
}