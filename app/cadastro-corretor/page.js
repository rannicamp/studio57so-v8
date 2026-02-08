// app/cadastro-corretor/page.js
'use client'

// MUDANÇA 1: Usamos apenas useState (memória temporária)
import { useState, useEffect } from 'react' 
import { registerRealtor } from './actions'
import { getLatestTerms } from './terms-actions'
// O import do usePersistentState foi removido por segurança
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faSpinner, 
  faCheckCircle, 
  faBuildingUser,
  faFileContract,
  faXmark,
  faEraser // Ícone novo para o botão de limpar
} from '@fortawesome/free-solid-svg-icons'

// ID DA ORGANIZAÇÃO DEFINIDO AQUI
const ORGANIZACAO_ID = 2;

export default function CadastroCorretorPage() {
  // MUDANÇA 2: Estado simples. Atualizou a página? Limpou tudo!
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    creci: '',
    cpf: '',
    estado_civil: '',
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    acceptedTerms: false,
    termId: null
  })

  // DADOS SENSÍVEIS (Senha já era temporária, continua assim)
  const [securityData, setSecurityData] = useState({
    password: '',
    confirmPassword: ''
  })
  
  const [termContent, setTermContent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCep, setIsLoadingCep] = useState(false)
  const [success, setSuccess] = useState(false)

  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/LOGO-P_1765565958716.PNG";

  // Carregar os termos ao iniciar a página (Busca nova a cada F5)
  useEffect(() => {
    async function loadTerms() {
        try {
            const term = await getLatestTerms(ORGANIZACAO_ID);
            if (term) {
                setTermContent(term.conteudo);
                setFormData(prev => ({ ...prev, termId: term.id }));
            }
        } catch (error) {
            console.error("Erro silencioso ao carregar termos:", error);
        }
    }
    loadTerms();
  }, []) // Array vazio = roda apenas uma vez quando a página abre

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value

    if (name === 'password' || name === 'confirmPassword') {
        setSecurityData(prev => ({ ...prev, [name]: val }))
    } else {
        setFormData(prev => ({ ...prev, [name]: val }))
    }
  }

  // Função para limpar manualmente (Botão extra de segurança)
  const handleClear = () => {
      if(confirm('Deseja limpar todos os campos?')) {
          setFormData(prev => ({
              nome: '', email: '', creci: '', cpf: '', estado_civil: '',
              cep: '', address_street: '', address_number: '', address_complement: '',
              neighborhood: '', city: '', state: '', acceptedTerms: false, 
              termId: prev.termId // Mantém só o ID do termo
          }));
          setSecurityData({ password: '', confirmPassword: '' });
          toast.info('Formulário limpo.');
      }
  }

  const handleCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setIsLoadingCep(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
            setFormData(prev => ({
                ...prev,
                address_street: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                state: data.uf
            }));
        } else {
            toast.error('CEP não encontrado.');
        }
    } catch (error) {
        console.error("Erro ao buscar CEP", error);
    } finally {
        setIsLoadingCep(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    // REDE DE SEGURANÇA: GARANTIR O TERM ID
    let currentTermId = formData.termId;

    if (!currentTermId) {
        try {
            const term = await getLatestTerms(ORGANIZACAO_ID);
            if (term && term.id) {
                currentTermId = term.id;
            } else {
                toast.error('Erro de conexão: Não foi possível carregar os Termos. Verifique sua internet.');
                setIsLoading(false);
                return;
            }
        } catch (err) {
            toast.error('Erro crítico ao validar termos. Recarregue a página.');
            setIsLoading(false);
            return;
        }
    }

    const payload = {
        ...formData,
        termId: currentTermId,
        ...securityData
    }

    if (payload.password !== payload.confirmPassword) {
      toast.error('Senhas não conferem')
      setIsLoading(false)
      return
    }

    if (!payload.acceptedTerms) {
        toast.error('É necessário aceitar os Termos de Uso.')
        setIsLoading(false)
        return
    }

    const result = await registerRealtor(payload)

    setIsLoading(false)

    if (result?.error) {
      toast.error('Erro no Cadastro', { description: result.error })
    } else if (result?.success) {
      setSuccess(true)
      toast.success('Cadastro realizado!', { description: 'Verifique seu e-mail.' })
      
      // Limpeza completa após sucesso
      setFormData({
        nome: '', email: '', creci: '', cpf: '', estado_civil: '',
        cep: '', address_street: '', address_number: '', address_complement: '',
        neighborhood: '', city: '', state: '', acceptedTerms: false, termId: currentTermId
      });
      setSecurityData({ password: '', confirmPassword: '' });
    } else {
      toast.error('Erro Inesperado')
    }
  }

  const TermsModal = () => {
    if (!showModal) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileContract} className="text-blue-600" /> Termos de Parceria
                    </h3>
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faXmark} className="text-xl" /></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {termContent ? (
                        <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: termContent }} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8">
                             <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600 text-2xl mb-2" />
                             <p className="text-gray-500">Carregando termos...</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-lg">
                    <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-medium">Fechar</button>
                    <button 
                        onClick={() => { 
                            setFormData(prev => ({ ...prev, acceptedTerms: true })); 
                            setShowModal(false); 
                            toast.success("Termos aceitos!"); 
                        }} 
                        disabled={!termContent}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Li e Aceito
                    </button>
                </div>
            </div>
        </div>
    )
  }
  
  if (success) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md text-center">
                 <div className="mb-6 flex justify-center"><Image src={logoUrl} alt="Logo Studio 57" width={160} height={50} priority className="object-contain" /></div>
                 <FontAwesomeIcon icon={faCheckCircle} className="text-6xl text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Cadastro Concluído!</h2>
                <p className="text-gray-600 mb-6">Enviamos um e-mail de confirmação para <strong>{formData.email}</strong>.</p>
                <Link href="/login"><span className="w-full block bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 font-semibold cursor-pointer">Ir para Login</span></Link>
            </div>
        </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-12 relative">
      <TermsModal />
      <div className="w-full max-w-2xl p-8 space-y-6 bg-white shadow-lg rounded-lg border border-gray-100">
        <div className="text-center">
            <div className="mb-6 flex justify-center"><Image src={logoUrl} alt="Logo Studio 57" width={180} height={60} priority className="object-contain" /></div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2"><FontAwesomeIcon icon={faBuildingUser} className="text-blue-600" /> Cadastro de Parceiro</h2>
            <p className="text-gray-500 mt-2 text-sm">Dados completos para geração de contratos.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          
          <div className="bg-gray-50 p-4 rounded-md border border-gray-100 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Dados Pessoais</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Nome Completo *</label>
                    <input name="nome" type="text" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Seu nome completo" value={formData.nome} onChange={handleChange} disabled={isLoading} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">CPF *</label>
                        <input name="cpf" type="text" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" placeholder="000.000.000-00" value={formData.cpf} onChange={handleChange} disabled={isLoading} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Estado Civil *</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                            <select name="estado_civil" required value={formData.estado_civil} onChange={handleChange} disabled={isLoading} className="block w-full p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white">
                                <option value="">Selecione...</option>
                                <option value="Solteiro(a)">Solteiro(a)</option>
                                <option value="Casado(a)">Casado(a)</option>
                                <option value="Divorciado(a)">Divorciado(a)</option>
                                <option value="Viúvo(a)">Viúvo(a)</option>
                                <option value="Separado(a)">Separado(a)</option>
                                <option value="União Estável">União Estável</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700">CRECI *</label>
                        <input name="creci" type="text" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" placeholder="Ex: 123456-F" value={formData.creci} onChange={handleChange} disabled={isLoading} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">E-mail *</label>
                        <input name="email" type="email" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" placeholder="voce@email.com" value={formData.email} onChange={handleChange} disabled={isLoading} />
                    </div>
                </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md border border-gray-100 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Endereço Completo</h3>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">CEP *</label>
                        <div className="relative">
                            <input name="cep" type="text" required maxLength={9} className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" placeholder="00000-000" value={formData.cep} onChange={handleChange} onBlur={handleCepBlur} disabled={isLoading} />
                            {isLoadingCep && <div className="absolute right-3 top-3 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div>}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Rua/Logradouro *</label>
                        <input name="address_street" type="text" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" value={formData.address_street} onChange={handleChange} disabled={isLoading} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Número *</label>
                        <input name="address_number" type="text" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" value={formData.address_number} onChange={handleChange} disabled={isLoading} />
                    </div>
                     <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Complemento</label>
                        <input name="address_complement" type="text" className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" placeholder="Apto, Bloco..." value={formData.address_complement} onChange={handleChange} disabled={isLoading} />
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Bairro *</label>
                        <input name="neighborhood" type="text" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" value={formData.neighborhood} onChange={handleChange} disabled={isLoading} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Cidade *</label>
                        <input name="city" type="text" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" value={formData.city} onChange={handleChange} disabled={isLoading} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">UF *</label>
                        <input name="state" type="text" required maxLength={2} className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm uppercase" value={formData.state} onChange={handleChange} disabled={isLoading} />
                    </div>
                </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md border border-gray-100 mb-4">
             <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Segurança</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Senha *</label><input name="password" type="password" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" placeholder="Mínimo 6 caracteres" value={securityData.password} onChange={handleChange} disabled={isLoading} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Confirmar Senha *</label><input name="confirmPassword" type="password" required className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md sm:text-sm" placeholder="Repita a senha" value={securityData.confirmPassword} onChange={handleChange} disabled={isLoading} /></div>
             </div>
          </div>

          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input id="acceptedTerms" name="acceptedTerms" type="checkbox" required checked={formData.acceptedTerms} onChange={handleChange} disabled={isLoading} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="acceptedTerms" className="font-medium text-gray-700">Li e concordo com os <button type="button" onClick={() => setShowModal(true)} className="text-blue-600 hover:text-blue-500 underline focus:outline-none">Termos de Parceria e Uso</button></label>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all">
              {isLoading ? (<><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Processando cadastro...</>) : 'Finalizar Cadastro'}
            </button>
            {/* Botão de Limpeza Manual */}
            <button type="button" onClick={handleClear} disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 focus:outline-none transition-all">
               <FontAwesomeIcon icon={faEraser} className="mr-2" /> Limpar Formulário
            </button>
          </div>
        </form>
        <div className="text-center pt-2 border-t border-gray-100"><p className="text-sm text-gray-600">Já possui cadastro? <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">Fazer Login</Link></p></div>
      </div>
    </div>
  )
}