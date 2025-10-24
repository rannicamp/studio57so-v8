// app/cadastro-corretor/page.js
'use client'

import { useState } from 'react'
import { registerRealtor } from './actions' // A nossa action simplificada!
import { toast } from 'sonner'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faIdCard, faLock, faUser, faEnvelope, faCheckCircle, faBuildingUser } from '@fortawesome/free-solid-svg-icons'

export default function CadastroCorretorPage() {
  const [formData, setFormData] = useState({
    nome: '', // Vamos usar só 'nome' por enquanto, como na action
    email: '',
    creci: '',
    cpf: '', // CPF Opcional
    password: '',
    confirmPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    // Validação extra da senha no front-end
    if (formData.password !== formData.confirmPassword) {
      toast.error('Erro de Validação', {
        description: 'As senhas não coincidem.',
      })
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
        toast.error('Erro de Validação', {
            description: 'A senha deve ter no mínimo 6 caracteres.',
        });
        setIsLoading(false);
        return;
    }

    // Chama a nossa Server Action simplificada
    const result = await registerRealtor(formData)

    // >>>>> DETETIVE DA PÁGINA <<<<<
    console.log('Resultado da Action:', result); 

    setIsLoading(false)

    if (result?.error) { // Verifica se 'result' existe ANTES de acessar 'error'
      toast.error('Erro no Cadastro', {
        description: result.error,
      })
    } else if (result?.success) { // Verifica se 'result' existe ANTES de acessar 'success'
      toast.success('Cadastro realizado com sucesso!')
      setSuccess(true) // Mostra a tela de sucesso
    } else {
      // Caso a action retorne algo inesperado (ou nada!)
      console.error("A Action não retornou 'success' nem 'error'. Resultado:", result); // Detetive Extra
      toast.error('Erro Inesperado', {
        description: 'Não foi possível completar o cadastro. Verifique o console.',
      })
    }
  }
  
  // Se o cadastro foi bem-sucedido, mostramos a tela de sucesso (igual à anterior)
  if (success) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-lg text-center">
                 <FontAwesomeIcon icon={faCheckCircle} className="text-6xl text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">
                    Cadastro Concluído!
                </h2>
                <p className="text-gray-600">
                    Enviamos um e-mail de confirmação para <strong>{formData.email}</strong>.
                    Por favor, verifique sua caixa de entrada (e spam) para ativar sua conta
                    antes de fazer o login.
                </p>
                <Link href="/login">
                    <span className="w-full block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold mt-6">
                        Ir para a Página de Login
                    </span>
                </Link>
            </div>
        </div>
    )
  }

  // Formulário de Cadastro (adaptado do seu UserManagementForm/AddUserModal)
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-12">
      {/* Usamos max-w-lg como no seu AddUserModal */}
      <div className="w-full max-w-lg p-8 space-y-6 bg-white shadow-2xl rounded-lg">
        
        <div className="text-center">
            {/* Ícone representando um corretor */}
            <FontAwesomeIcon icon={faBuildingUser} className="text-4xl text-blue-600 mb-3" /> 
            <h2 className="text-3xl font-bold text-gray-900">
                Cadastro de Corretor
            </h2>
            <p className="text-gray-500 mt-1">
                Junte-se à nossa plataforma. É rápido e fácil!
            </p>
        </div>

        {/* Usamos o onSubmit aqui em vez do 'action' do form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          
          {/* Campo Nome (Simplificado) */}
          <div>
            <label
              htmlFor="nome"
              className="block text-sm font-medium text-gray-700"
            >
              Nome Completo
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                 </div>
                <input
                    id="nome"
                    name="nome" // O nome do input precisa ser igual ao da action
                    type="text"
                    required
                    // Estilos baseados no seu AddUserModal
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Seu nome completo"
                    value={formData.nome}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>
          
          {/* Campo Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              E-mail
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
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="voce@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>
          
          {/* Campos CRECI e CPF lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="creci"
                className="block text-sm font-medium text-gray-700"
              >
                CRECI <span className="text-red-500">*</span> {/* Indicador de obrigatório */}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <FontAwesomeIcon icon={faIdCard} className="text-gray-400" />
                 </div>
                <input
                    id="creci"
                    name="creci"
                    type="text"
                    required
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Ex: 123456-F"
                    value={formData.creci}
                    onChange={handleChange}
                    disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
              <label
                htmlFor="cpf"
                className="block text-sm font-medium text-gray-700"
              >
                CPF (Opcional)
              </label>
               <div className="mt-1 relative rounded-md shadow-sm">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <FontAwesomeIcon icon={faIdCard} className="text-gray-400" />
                 </div>
                <input
                    id="cpf"
                    name="cpf"
                    type="text"
                    // Pode adicionar máscara aqui se quiser depois
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={handleChange}
                    disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Campo Senha */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Senha <span className="text-red-500">*</span>
            </label>
             <div className="mt-1 relative rounded-md shadow-sm">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <FontAwesomeIcon icon={faLock} className="text-gray-400" />
                 </div>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>
          
          {/* Campo Confirmar Senha */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirmar Senha <span className="text-red-500">*</span>
            </label>
             <div className="mt-1 relative rounded-md shadow-sm">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <FontAwesomeIcon icon={faLock} className="text-gray-400" />
                 </div>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Repita a senha"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>

          {/* Botão de Envio (como no seu AddUserModal) */}
          <div className="pt-6"> {/* Adiciona espaço acima do botão */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
              {isLoading ? (
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              ) : null}
              {isLoading ? 'Cadastrando...' : 'Finalizar Cadastro'}
            </button>
          </div>
        </form>
        
        {/* Link para Login */}
        <div className="text-center pt-4"> {/* Adiciona espaço acima do link */}
            <p className="text-sm text-gray-600">
                Já tem uma conta?{' '}
                <Link href="/login">
                    <span className="font-medium text-blue-600 hover:text-blue-500">
                        Faça seu login
                    </span>
                </Link>
            </p>
        </div>
      </div>
    </div>
  )
}