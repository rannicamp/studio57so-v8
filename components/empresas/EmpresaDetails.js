// components/empresas/EmpresaDetails.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faEdit } from '@fortawesome/free-solid-svg-icons';

import AnexoUploader from '../shared/AnexoUploader';
import ListaAnexos from '../shared/ListaAnexos';
import GaleriaMarketing from '../shared/GaleriaMarketing';

// Componente para exibir campos de informação simples
function InfoField({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  
  // Formata o capital social como moeda
  if (label === 'Capital Social' && !isNaN(value)) {
      value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function EmpresaDetails({ empresa, initialAnexos, documentoTipos, organizacaoId }) {
    const [activeTab, setActiveTab] = useState('ficha');
    const [anexos, setAnexos] = useState(initialAnexos || []);
    const supabase = createClient();

    useEffect(() => { setAnexos(initialAnexos || []); }, [initialAnexos]);

    const handleUploadSuccess = async (newAnexoData) => {
        const { data } = await supabase.storage.from('empresa-anexos').createSignedUrl(newAnexoData.caminho_arquivo, 3600);
        const anexoCompleto = {
            ...newAnexoData,
            public_url: data?.signedUrl,
            tipo: documentoTipos.find(t => t.id === newAnexoData.tipo_documento_id)
        };
        setAnexos(currentAnexos => [...currentAnexos, anexoCompleto]);
    };

    const handleDeleteAnexo = async (anexoToDelete) => {
        if (!anexoToDelete || !window.confirm(`Tem certeza que deseja excluir "${anexoToDelete.nome_arquivo}"?`)) return;
        
        toast.promise(
            new Promise(async (resolve, reject) => {
                const { error: storageError } = await supabase.storage.from('empresa-anexos').remove([anexoToDelete.caminho_arquivo]);
                if (storageError && storageError.statusCode !== '404') return reject(storageError);
                
                const { error: dbError } = await supabase.from('empresa_anexos').delete().eq('id', anexoToDelete.id);
                if (dbError) return reject(dbError);
                
                resolve("Anexo excluído com sucesso!");
            }),
            {
                loading: 'Excluindo...',
                success: (msg) => { 
                    setAnexos(currentAnexos => currentAnexos.filter(a => a.id !== anexoToDelete.id));
                    return msg; 
                },
                error: (err) => `Erro ao excluir: ${err.message}`,
            }
        );
    };

    const tabs = [
        { id: 'ficha', label: 'Ficha da Empresa' },
        { id: 'contabil', label: 'Documentos Contábeis' },
        { id: 'marketing', label: 'Marketing' },
    ];

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <Link href="/empresas" className="text-blue-500 hover:underline mb-2 inline-block text-sm">
                        &larr; Voltar para a Lista de Empresas
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">{empresa.razao_social}</h1>
                    <p className="text-gray-500">{empresa.nome_fantasia}</p>
                </div>
                <Link href={`/empresas/editar/${empresa.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 flex items-center gap-2">
                    <FontAwesomeIcon icon={faEdit} /> Editar
                </Link>
            </div>
            
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                {activeTab === 'ficha' && (
                    <div className="space-y-8 animate-fade-in">
                        {/* ================================================================================= */}
                        {/* CORREÇÃO APLICADA AQUI: ADICIONANDO TODOS OS CAMPOS FALTANTES */}
                        {/* ================================================================================= */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-800">Dados Cadastrais</h2>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField label="Razão Social" value={empresa.razao_social} />
                                <InfoField label="Nome Fantasia" value={empresa.nome_fantasia} />
                                <InfoField label="CNPJ" value={empresa.cnpj} />
                                <InfoField label="Inscrição Estadual" value={empresa.inscricao_estadual} />
                                <InfoField label="Inscrição Municipal" value={empresa.inscricao_municipal} />
                            </div>
                        </section>

                        <section className="pt-6 border-t">
                            <h2 className="text-xl font-semibold text-gray-800">Dados Legais</h2>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField label="Natureza Jurídica" value={empresa.natureza_juridica} />
                                <InfoField label="Capital Social" value={empresa.capital_social} />
                                <InfoField label="Responsável Legal" value={empresa.responsavel_legal} />
                                <div className="md:col-span-3">
                                  <InfoField label="Objeto Social" value={empresa.objeto_social} />
                                </div>
                            </div>
                        </section>

                        <section className="pt-6 border-t">
                            <h3 className="text-xl font-semibold text-gray-800">Contato e Endereço</h3>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField label="Telefone" value={empresa.telefone} />
                                <InfoField label="E-mail" value={empresa.email} />
                                <div /> 
                                <InfoField label="CEP" value={empresa.cep} />
                                <InfoField label="Rua" value={empresa.logradouro} />
                                <InfoField label="Número" value={empresa.numero} />
                                <InfoField label="Complemento" value={empresa.complemento} />
                                <InfoField label="Bairro" value={empresa.bairro} />
                                <InfoField label="Cidade" value={empresa.cidade} />
                                <InfoField label="Estado" value={empresa.uf} />
                            </div>
                        </section>
                    </div>
                )}
                
                {activeTab === 'contabil' && (
                     <div className="space-y-6 animate-fade-in">
                        <AnexoUploader parentId={empresa.id} storageBucket="empresa-anexos" tableName="empresa_anexos" allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="contabil" organizacaoId={organizacaoId} />
                        <ListaAnexos anexos={anexos.filter(a => a.categoria_aba === 'contabil')} onDelete={handleDeleteAnexo} />
                    </div>
                )}

                {activeTab === 'marketing' && (
                     <div className="space-y-6 animate-fade-in">
                        <AnexoUploader parentId={empresa.id} storageBucket="empresa-anexos" tableName="empresa_anexos" allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="marketing" organizacaoId={organizacaoId} />
                        <GaleriaMarketing anexos={anexos.filter(a => a.categoria_aba === 'marketing')} storageBucket="empresa-anexos" onDelete={handleDeleteAnexo} />
                    </div>
                )}
            </div>
        </div>
    );
}