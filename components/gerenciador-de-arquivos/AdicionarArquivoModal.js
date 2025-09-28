// Caminho: components/gerenciador-de-arquivos/AdicionarArquivoModal.js
'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faUpload, faXmark } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';

const fetchModalData = async () => {
    const supabase = createClient();
    // O PORQUÊ DA MUDANÇA: Agora buscamos também a qual empresa cada empreendimento pertence.
    const { data: empreendimentos, error: empreendimentosError } = await supabase
        .from('empreendimentos')
        .select('id, nome, empresa_proprietaria_id')
        .order('nome', { ascending: true });
    if (empreendimentosError) throw new Error(empreendimentosError.message);

    const { data: tipos, error: tiposError } = await supabase.from('documento_tipos').select('id, descricao, sigla').order('descricao', { ascending: true });
    if (tiposError) throw new Error(tiposError.message);

    // Buscamos também a lista de todas as empresas.
    const { data: empresas, error: empresasError } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').order('nome_fantasia', { ascending: true });
    if (empresasError) throw new Error(empresasError.message);

    return { empreendimentos, tipos, empresas };
};

export default function AdicionarArquivoModal({ isOpen, onClose, onUploadSuccess }) {
    const supabase = createClient();
    const [file, setFile] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [empreendimentoId, setEmpreendimentoId] = useState('');
    const [empresaId, setEmpresaId] = useState(''); // Novo estado para a empresa
    const [tipoId, setTipoId] = useState('');
    const [categoria, setCategoria] = useState('marketing');
    const [isUploading, setIsUploading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef(null);

    const { data, isLoading } = useQuery({ queryKey: ['modalUploadData'], queryFn: fetchModalData, enabled: isOpen });

    // O PORQUÊ DESTE useEffect:
    // Esta é a mágica da automação. Sempre que você selecionar um empreendimento,
    // este código encontrará a empresa correspondente e a selecionará automaticamente.
    useEffect(() => {
        if (empreendimentoId && data?.empreendimentos) {
            const selectedEmpreendimento = data.empreendimentos.find(e => e.id == empreendimentoId);
            if (selectedEmpreendimento?.empresa_proprietaria_id) {
                setEmpresaId(selectedEmpreendimento.empresa_proprietaria_id);
            }
        } else {
           // Se nenhum empreendimento for selecionado, limpamos a empresa para permitir a seleção manual.
           setEmpresaId('');
        }
    }, [empreendimentoId, data?.empreendimentos]);


    const handleFileSelect = async (selectedFile) => {
        if (!selectedFile) return;
        if (!selectedFile.type.startsWith('image/')) { setFile(selectedFile); return; }
        const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
        try {
            toast.info("Otimizando imagem...");
            const compressedFile = await imageCompression(selectedFile, options);
            setFile(compressedFile);
            toast.success("Imagem otimizada!");
        } catch (error) {
            toast.error('Não foi possível otimizar. Usando o arquivo original.');
            setFile(selectedFile);
        }
    };

    const resetState = () => {
        setFile(null); setDescricao(''); setEmpreendimentoId(''); setTipoId(''); setEmpresaId(''); setCategoria('marketing');
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUpload = async () => {
        // O PORQUÊ DA MUDANÇA: A validação agora exige um arquivo, tipo E (empreendimento OU empresa).
        if (!file || !tipoId || (!empreendimentoId && !empresaId)) {
            toast.error("Selecione um arquivo, tipo e associe a um Empreendimento ou a uma Empresa.");
            return;
        }

        setIsUploading(true);
        
        const promise = new Promise(async (resolve, reject) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return reject(new Error("Usuário não autenticado."));
            const { data: userData, error: userError } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
            if (userError || !userData) return reject(new Error("Não foi possível identificar a organização do usuário."));
            
            const tipoSelecionado = data.tipos.find(t => t.id == tipoId);
            const sigla = tipoSelecionado?.sigla || 'DOC';
            const fileExt = file.name.split('.').pop();
            // O nome do arquivo agora usa o ID da empresa se o empreendimento não for selecionado.
            const pathPrefix = empreendimentoId || empresaId;
            const newFileName = `${pathPrefix}/${sigla}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('empreendimento-anexos').upload(newFileName, file);
            if (uploadError) return reject(uploadError);

            // O PORQUÊ DA MUDANÇA: O objeto de inserção agora é dinâmico, incluindo
            // 'empreendimento_id' ou 'empresa_id' conforme o que foi selecionado.
            const insertData = { 
                caminho_arquivo: newFileName, 
                nome_arquivo: file.name, 
                descricao: descricao, 
                tipo_documento_id: tipoId, 
                categoria_aba: categoria,
                usuario_id: user.id,
                organizacao_id: userData.organizacao_id,
                empreendimento_id: empreendimentoId || null,
                empresa_id: empresaId || null
            };

            const { error: dbError } = await supabase.from('empreendimento_anexos').insert(insertData);
            if (dbError) return reject(dbError);
            
            resolve("Arquivo enviado com sucesso!");
        });

        toast.promise(promise, {
            loading: 'Enviando arquivo...',
            success: (msg) => { onUploadSuccess(); resetState(); onClose(); return msg; },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsUploading(false),
        });
    };
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-2xl relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faXmark} size="lg" /></button>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Adicionar Novo Arquivo</h3>
                        {isLoading ? <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select value={empreendimentoId} onChange={(e) => setEmpreendimentoId(e.target.value)} className="p-2 border rounded-md w-full"><option value="">-- Associar a um Empreendimento (Opcional) --</option>{data?.empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
                                    <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} disabled={!!empreendimentoId} className="p-2 border rounded-md w-full disabled:bg-gray-100"><option value="">-- Ou associar a uma Empresa --</option>{data?.empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}</select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="p-2 border rounded-md w-full"><option value="">-- Selecione o Tipo de Documento --</option>{data?.tipos.map(t => <option key={t.id} value={t.id}>{t.descricao} ({t.sigla})</option>)}</select>
                                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="p-2 border rounded-md w-full"><option value="marketing">Marketing</option><option value="juridico">Jurídico</option><option value="geral">Geral</option><option value="marca">Marca</option></select>
                                </div>
                                <input type="text" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="p-2 border rounded-md w-full" />
                                {/* ... Drag and drop e botão de upload ... */}
                                <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer`}>
                                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0])} />
                                    <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-gray-400 mb-3" />
                                    {file ? (<div><p className="font-semibold">{file.name}</p><p className="text-sm">{(file.size / 1024).toFixed(2)} KB</p></div>) : (<p>Arraste e solte ou <span className="font-semibold text-blue-600">clique aqui</span>.</p>)}
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={handleUpload} disabled={isUploading || !file || !tipoId || (!empreendimentoId && !empresaId)} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                                        {isUploading ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : <FontAwesomeIcon icon={faUpload} className="mr-2" />}
                                        {isUploading ? 'Enviando...' : 'Enviar Arquivo'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}