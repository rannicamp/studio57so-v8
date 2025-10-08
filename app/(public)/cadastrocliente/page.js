// app/(public)/cadastro-cliente/page.js
'use client';

import { useState, useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createContact } from './actions'; // <<<=== A MUDANÇA ESTÁ AQUI
import { IMaskInput } from 'react-imask';

const initialState = {
  message: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
    >
      {pending ? 'Enviando...' : 'Enviar Cadastro'}
    </button>
  );
}

export default function CadastroClientePage() {
  const [state, formAction] = useActionState(createContact, initialState);
  const [tipoPessoa, setTipoPessoa] = useState('pf');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState({
    street: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [showConjuge, setShowConjuge] = useState(false);

  const handleEstadoCivilChange = (e) => {
    const value = e.target.value;
    setShowConjuge(value === 'Casado(a)' || value === 'União Estável');
  };
  
  useEffect(() => {
    if (cep.replace(/\D/g, '').length === 8) {
      fetch(`/api/cep?cep=${cep.replace(/\D/g, '')}`)
        .then(res => res.json())
        .then(data => {
          if (!data.erro) {
            setEndereco({
              street: data.logradouro,
              neighborhood: data.bairro,
              city: data.localidade,
              state: data.uf
            });
          }
        });
    }
  }, [cep]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white p-8 rounded-lg shadow-md">
        
        <div className="flex justify-center mb-6">
            <img
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG" 
                alt="Studio 57"
                className="h-16 w-auto"
            />
        </div>
        
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Ficha Cadastral</h1>
        <p className="text-center text-gray-500 mb-6">Preencha os campos abaixo para realizar o seu cadastro.</p>
        
        <form action={formAction}>
          <div className="mb-6">
            <div className="flex border border-gray-300 rounded-md p-1">
              <button type="button" onClick={() => setTipoPessoa('pf')} className={`w-1/2 p-2 rounded-md transition-colors ${tipoPessoa === 'pf' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>
                Pessoa Física
              </button>
              <button type="button" onClick={() => setTipoPessoa('pj')} className={`w-1/2 p-2 rounded-md transition-colors ${tipoPessoa === 'pj' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>
                Pessoa Jurídica
              </button>
            </div>
            <input type="hidden" name="tipoPessoa" value={tipoPessoa} />
          </div>

          {tipoPessoa === 'pf' ? (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-2">Dados Pessoais</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="nome" placeholder="Nome Completo" className="input-style" required />
                    <IMaskInput mask="000.000.000-00" name="cpf" placeholder="CPF" className="input-style" required />
                    <input name="rg" placeholder="RG" className="input-style" />
                    <div>
                        <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                        <input name="birth_date" id="birth_date" type="date" className="input-style" />
                    </div>
                    <input name="nacionalidade" placeholder="Nacionalidade" className="input-style" />
                    <select name="estado_civil" className="input-style" onChange={handleEstadoCivilChange}>
                        <option value="">Estado Civil</option>
                        <option value="Solteiro(a)">Solteiro(a)</option>
                        <option value="Casado(a)">Casado(a)</option>
                        <option value="União Estável">União Estável</option>
                        <option value="Divorciado(a)">Divorciado(a)</option>
                        <option value="Viúvo(a)">Viúvo(a)</option>
                    </select>
                    <div className="md:col-span-2">
                        <input name="cargo" placeholder="Profissão/Cargo/Função" className="input-style" />
                    </div>
                </div>
                {showConjuge && (
                    <>
                        <h3 className="text-lg font-semibold text-gray-600 pt-4">Dados do Cônjuge</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-md">
                           <input name="conjuge_nome" placeholder="Nome do Cônjuge" className="input-style" />
                           <IMaskInput mask="000.000.000-00" name="conjuge_cpf" placeholder="CPF do Cônjuge" className="input-style" />
                           <input name="conjuge_rg" placeholder="RG do Cônjuge" className="input-style" />
                           <select name="regime_bens" className="input-style md:col-span-3">
                               <option value="">Regime de Bens</option>
                               <option value="Comunhão Parcial de Bens">Comunhão Parcial de Bens</option>
                               <option value="Comunhão Universal de Bens">Comunhão Universal de Bens</option>
                               <option value="Separação Total de Bens">Separação Total de Bens</option>
                               <option value="Participação Final nos Aquestos">Participação Final nos Aquestos</option>
                           </select>
                        </div>
                    </>
                )}
            </div>
          ) : (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-2">Dados Empresariais</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="razao_social" placeholder="Razão Social" className="input-style" required />
                    <input name="nome_fantasia" placeholder="Nome Fantasia" className="input-style" />
                    <IMaskInput mask="00.000.000/0000-00" name="cnpj" placeholder="CNPJ" className="input-style" required />
                    <input name="inscricao_estadual" placeholder="Inscrição Estadual" className="input-style" />
                    <input name="responsavel_legal" placeholder="Responsável Legal" className="input-style" />
                    <input name="pessoa_contato" placeholder="Pessoa de Contato" className="input-style" />
                    <div className="md:col-span-2">
                        <input name="cargo" placeholder="Cargo/Função da Pessoa de Contato" className="input-style" />
                    </div>
                </div>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 border-b pb-2">Informações de Contato</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <IMaskInput mask="(00) 00000-0000" name="telefone_principal" placeholder="Telefone Principal" className="input-style" required />
                <input name="email_principal" type="email" placeholder="E-mail Principal" className="input-style" required />
                <IMaskInput mask="(00) 00000-0000" name="telefone_secundario" placeholder="Telefone Secundário (Opcional)" className="input-style" />
                <input name="email_secundario" type="email" placeholder="E-mail Secundário (Opcional)" className="input-style" />
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 border-b pb-2">Endereço</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <IMaskInput mask="00000-000" value={cep} onAccept={(value) => setCep(value)} name="cep" placeholder="CEP" className="input-style md:col-span-1" />
                <input name="address_street" value={endereco.street} onChange={(e) => setEndereco({...endereco, street: e.target.value})} placeholder="Rua / Logradouro" className="input-style md:col-span-3" />
                <input name="address_number" placeholder="Número" className="input-style md:col-span-1" />
                <input name="address_complement" placeholder="Complemento (Opcional)" className="input-style md:col-span-1" />
                <input name="neighborhood" value={endereco.neighborhood} onChange={(e) => setEndereco({...endereco, neighborhood: e.target.value})} placeholder="Bairro" className="input-style md:col-span-2" />
                <input name="city" value={endereco.city} onChange={(e) => setEndereco({...endereco, city: e.target.value})} placeholder="Cidade" className="input-style md:col-span-2" />
                <input name="state" value={endereco.state} onChange={(e) => setEndereco({...endereco, state: e.target.value})} placeholder="Estado" className="input-style md:col-span-2" />
            </div>
          </div>

          <div className="mt-6">
            <textarea name="observations" placeholder="Observações (Opcional)" className="input-style w-full" rows="3"></textarea>
          </div>

          <div className="mt-6">
            <SubmitButton />
          </div>
          
          {state?.message && <p className="mt-4 text-red-500 text-center">{state.message}</p>}
        </form>
        
        <style jsx global>{`
            .input-style {
                width: 100%;
                padding: 10px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                transition: border-color 0.2s;
            }
            .input-style:focus {
                outline: none;
                border-color: #3b82f6;
            }
        `}</style>
      </div>
    </div>
  );
}