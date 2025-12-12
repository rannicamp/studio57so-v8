// app/cadastro-corretor/page.js
'use client'

import { useState } from 'react'
import { registerRealtor } from './actions'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faSpinner, 
  faIdCard, 
  faLock, 
  faUser, 
  faEnvelope, 
  faCheckCircle, 
  faBuildingUser,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons'

export default function CadastroCorretorPage() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    creci: '',
    cpf: '',
    password: '',
    confirmPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // --- NOVA LOGO ATUALIZADA ---
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/LOGO-P_1765565958716.PNG";

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    // Validações de Front-end
    if (formData.password !== formData.confirmPassword) {
      toast.error('Senhas não conferem', {
        description: 'Por favor, verifique os campos de senha.',
      })
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
        toast.error('Senha fraca', {
            description: 'A senha deve ter no mínimo 6 caracteres.',
        });
        setIsLoading(false);
        return;
    }

    // Chama a Server Action
    const result = await registerRealtor(formData)

    setIsLoading(false)

    if (result?.error) {
      toast.error('Erro no Cadastro', {
        description: result.error,
      })
    } else if (result?.success) {
      setSuccess(true)
      toast.success('Cadastro realizado!', {
        description: 'Verifique seu e-mail para confirmar a conta.'
      })
    } else {
      toast.error('Erro Inesperado', {
        description: 'Tente novamente ou contate o suporte.',
      })
    }
  }
  
  // TELA DE SUCESSO
  if (success) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md text-center">
                 <div className="mb-6 flex justify-center">
                    <Image src={logoUrl} alt="Logo Studio 57" width={160} height={50} priority className="object-contain" />
                 </div>
                 
                 <FontAwesomeIcon icon={faCheckCircle} className="text-6xl text-green-500 mb-4" />
                
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Cadastro Concluído!
                </h2>
                <p className="text-gray-600 mb-6">
                    Enviamos um e-mail de confirmação para <strong>{formData.email}</strong>.
                    Por favor, verifique sua caixa de entrada (e spam) para ativar sua conta
                    antes de fazer o login.
                </p>
                <Link href="/login">
                    <span className="w-full block bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 font-semibold transition-colors shadow-sm">
                        Ir para a Página de Login
                    </span>
                </Link>
            </div>
        </div>
    )
  }

  // FORMULÁRIO DE CADASTRO
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg p-8 space-y-6 bg-white shadow-lg rounded-lg border border-gray-100">
        
        <div className="text-center">
            <div className="mb-6 flex justify-center">
                <Image src={logoUrl} alt="Logo Studio 57" width={180} height={60} priority className="object-contain" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faBuildingUser} className="text-blue-600" /> 
                Cadastro de Parceiro
            </h2>
            <p className="text-gray-500 mt-2 text-sm">
                Preencha seus dados para acessar o Portal do Corretor.
            </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          
          {/* Campo Nome */}
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
              Nome Completo
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                 </div>
                <input
                    id="nome"
                    name="nome"
                    type="text"
                    required
                    className="block w-full pl-10 p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition-colors"
                    placeholder="Seu nome completo"
                    value={formData.nome}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>
          
          {/* Campo Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                    className="block w-full pl-10 p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition-colors"
                    placeholder="voce@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>
          
          {/* Campos CRECI e CPF */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="creci" className="block text-sm font-medium text-gray-700">
                CRECI <span className="text-red-500">*</span>
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
                    className="block w-full pl-10 p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition-colors"
                    placeholder="Ex: 123456-F"
                    value={formData.creci}
                    onChange={handleChange}
                    disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">
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
                    className="block w-full pl-10 p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition-colors"
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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
                    className="block w-full pl-10 p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition-colors"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>
          
          {/* Campo Confirmar Senha */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirmar Senha <span className="text-red-500">*</span>
            </label>
             <div className="mt-1 relative rounded-md shadow-sm">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <FontAwesomeIcon icon={faCheckCircle} className="text-gray-400" />
                 </div>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="block w-full pl-10 p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition-colors"
                    placeholder="Repita a senha"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                />
            </div>
          </div>

          {/* Botão de Envio */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                  Criando conta...
                </>
              ) : 'Finalizar Cadastro'}
            </button>
          </div>
        </form>
        
        {/* Link para Login */}
        <div className="text-center pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">
                Já possui cadastro?{' '}
                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                    Fazer Login
                </Link>
            </p>
        </div>
      </div>
    </div>
  )
}