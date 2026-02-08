// components/RdoForm.js

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruck, faCheckCircle, faPrint, faFilePdf, faSpinner, faLock, faDownload } from '@fortawesome/free-solid-svg-icons';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import { notificarGrupo } from '@/utils/notificacoes';
import RdoPrintView from './RdoPrintView';

// Importação dinâmica do html2pdf para evitar erros de SSR
let html2pdf;
if (typeof window !== "undefined") {
  import("html2pdf.js").then((module) => {
    html2pdf = module.default;
  });
}

const STATUS_CONFIG = {
  'em andamento': { order: 1, colorClass: 'border-l-4 border-blue-500' },
  'aguardando material': { order: 2, colorClass: 'border-l-4 border-orange-400' },
  'pausado': { order: 3, colorClass: 'border-l-4 border-yellow-500' },
  'não iniciado': { order: 4, colorClass: 'border-l-4 border-gray-300' },
  'concluído': { order: 5, colorClass: 'border-l-4 border-green-500' },
  'cancelado': { order: 6, colorClass: 'border-l-4 border-red-500' },
};

export default function RdoForm({ initialRdoData, selectedEmpreendimento }) {
  const supabase = createClient();
  const { hasPermission, user } = useAuth();
  const organizacaoId = user?.organizacao_id;
  const printRef = useRef();

  const [message, setMessage] = useState('');
  const [loadingForm, setLoadingForm] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // NOVO ESTADO: Controla o loading da impressão e URL do PDF
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [savedPdfUrl, setSavedPdfUrl] = useState(null);

  const [rdoFormData, setRdoFormData] = useState({});
  const [activityStatuses, setActivityStatuses] = useState([]);
  const [employeePresences, setEmployeePresences] = useState([]);

  const [allOccurrences, setAllOccurrences] = useState([]);
  const [currentNewOccurrence, setCurrentNewOccurrence] = useState({ tipo: 'Informativa', descricao: '' });
  const [allPhotosMetadata, setAllPhotosMetadata] = useState([]);
  const [currentPhotoFile, setCurrentPhotoFile] = useState(null);
  const [currentPhotoDescription, setCurrentPhotoDescription] = useState('');

  const [pedidosPrevistos, setPedidosPrevistos] = useState([]);
  const [isRdoLocked, setIsRdoLocked] = useState(false);

  const [responsavelOriginal, setResponsavelOriginal] = useState(null);

  const weatherOptions = ["Ensolarado", "Nublado", "Chuvoso", "Parcialmente Nublado", "Ventania", "Tempestade"];
  const occurrenceTypes = ["Informativa", "Alerta", "Grave", "Acidente de Trabalho", "Condição Insegura"];

  // =======================================================================
  // FUNÇÃO DE IMPRESSÃO AUTOMATIZADA COM CORREÇÃO DE IMAGENS 📸
  // =======================================================================
  const handleFinalizeRdo = async () => {
    if (isGeneratingPdf || !html2pdf) return;
    
    if (!window.confirm("Atenção: Ao finalizar, um PDF será gerado e arquivado. O RDO será fechado para edições. Deseja continuar?")) {
      return;
    }

    setIsGeneratingPdf(true);
    const toastId = toast.loading("Processando imagens e gerando PDF...");

    try {
        // 1. Pega o elemento original
        const element = printRef.current;
        if (!element) throw new Error("Elemento de impressão não encontrado.");

        // 2. Clona o elemento para podermos modificar as imagens (Base64) sem afetar a tela do usuário
        const clone = element.cloneNode(true);

        // 3. PROCESSO DE CONVERSÃO DE IMAGENS (Base64)
        // Isso resolve o problema de imagens em branco no PDF por causa de bloqueio de segurança (CORS)
        const images = clone.querySelectorAll('img');
        const imagePromises = Array.from(images).map(async (img) => {
            try {
                // Ignora se não tiver src ou se já for base64
                if (!img.src || img.src.startsWith('data:')) return;

                // Faz o fetch da imagem (bypassando cache se necessário com mode: cors)
                const response = await fetch(img.src, { mode: 'cors' });
                const blob = await response.blob();
                
                // Converte Blob para Base64 DataURL
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        img.src = reader.result; // Substitui a URL externa pela string Base64 no clone
                        img.srcset = ''; // Remove srcset para evitar conflitos
                        resolve();
                    };
                    reader.onerror = () => {
                        console.warn("Erro ao ler imagem:", img.src);
                        resolve(); // Resolve mesmo com erro para não travar o processo
                    };
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                console.warn("Falha ao processar imagem para PDF:", err);
                return Promise.resolve();
            }
        });

        // Aguarda todas as imagens serem convertidas
        await Promise.all(imagePromises);

        // 4. Cria um container temporário invisível para renderizar o Clone
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '-10000px';
        container.style.left = '0';
        container.style.width = '210mm'; // Garante largura A4
        container.style.zIndex = '-9999';
        container.appendChild(clone);
        document.body.appendChild(container);

        // 5. Configurações do html2pdf
        const opt = {
            margin:       0,
            filename:     `RDO_${rdoFormData.rdo_numero || 'SN'}_${rdoFormData.data_relatorio}.pdf`,
            image:        { type: 'jpeg', quality: 0.95 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                scrollY: 0,
                windowWidth: 1000 
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 6. Gera o PDF a partir do CLONE (que agora tem imagens embutidas)
        const pdfBlob = await html2pdf().set(opt).from(clone).output('blob');

        // 7. Limpeza: Remove o clone do DOM
        document.body.removeChild(container);

        // 8. Upload para o Supabase Storage
        const fileName = `${organizacaoId}/${rdoFormData.empreendimento_id}/${Date.now()}_RDO.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('rdo-pdfs')
            .upload(fileName, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

        // 9. Pega a URL Pública e Salva no Banco
        const { data: publicUrlData } = supabase.storage
            .from('rdo-pdfs')
            .getPublicUrl(fileName);
        
        const finalPdfUrl = publicUrlData.publicUrl;

        await supabase
            .from('diarios_obra')
            .update({ pdf_url: finalPdfUrl })
            .eq('id', rdoFormData.id)
            .eq('organizacao_id', organizacaoId)
            .throwOnError();

        setSavedPdfUrl(finalPdfUrl);
        setIsRdoLocked(true); 
        toast.success("RDO Finalizado e Arquivado com sucesso!", { id: toastId });

    } catch (error) {
        console.error("Erro ao finalizar RDO:", error);
        toast.error(`Falha ao gerar PDF: ${error.message}`, { id: toastId });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  // Função antiga de impressão manual (Rascunho)
  const handlePrintDraft = () => {
    window.print();
  };

  const setupFormWithData = useCallback(async (rdoData) => {
    if (!rdoData || !organizacaoId) {
      setLoadingForm(false);
      if(!organizacaoId) toast.error("Erro de segurança: Organização não identificada.");
      return;
    }
    setLoadingForm(true);

    try {
      setRdoFormData({
        id: rdoData.id,
        data_relatorio: rdoData.data_relatorio,
        rdo_numero: rdoData.rdo_numero,
        condicoes_climaticas: rdoData.condicoes_climaticas,
        condicoes_trabalho: rdoData.condicoes_trabalho,
        empreendimento_id: rdoData.empreendimento_id,
        responsavel_nome: rdoData.usuarios ? `${rdoData.usuarios.nome} ${rdoData.usuarios.sobrenome}` : (rdoData.responsavel_rdo || 'Não identificado'),
        pdf_url: rdoData.pdf_url // Carrega a URL se existir
      });

      if (rdoData.pdf_url) {
          setSavedPdfUrl(rdoData.pdf_url);
      }

      if (rdoData.usuarios) {
        setResponsavelOriginal(`${rdoData.usuarios.nome} ${rdoData.usuarios.sobrenome}`);
      } else {
        setResponsavelOriginal(rdoData.responsavel_rdo || 'Não identificado');
      }

      setAllOccurrences(rdoData.ocorrencias || []);

      const empreendimentoId = rdoData.empreendimento_id;
      const dataRelatorio = new Date(rdoData.data_relatorio + 'T00:00:00Z');
      const dataRelatorioStr = rdoData.data_relatorio;

      const { data: pedidosData } = await supabase
        .from('pedidos_compra')
        .select('id, titulo, justificativa, status, itens:pedidos_compra_itens(descricao_item)')
        .eq('empreendimento_id', empreendimentoId)
        .eq('data_entrega_prevista', rdoData.data_relatorio)
        .eq('organizacao_id', organizacaoId);
      setPedidosPrevistos(pedidosData || []);
      
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, nome, status, tipo_atividade, data_inicio_prevista, data_fim_real')
        .eq('empreendimento_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId);
      
      const filteredActivities = (activitiesData || []).filter(act => {
          if (act.tipo_atividade === 'Entrega de Pedido' || act.nome.startsWith('Entrega Pedido')) {
              return false;
          }

          const dataInicioPrevistaStr = act.data_inicio_prevista;
          const dataFimRealStr = act.data_fim_real;

          if (act.status === 'Em Andamento') {
              return true;
          }

          if (act.status === 'Concluído' && dataFimRealStr === dataRelatorioStr) {
              return true;
          }
          
          if (act.status !== 'Concluído' && dataInicioPrevistaStr && dataInicioPrevistaStr <= dataRelatorioStr) {
              return true;
          }

          return false;
      });

      const { data: employeesData } = await supabase
        .from('funcionarios')
        .select('id, full_name, status, admission_date, demission_date')
        .eq('empreendimento_atual_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId);
      
      const activeEmployees = (employeesData || []).filter(emp => {
          const admissionDate = emp.admission_date ? new Date(emp.admission_date + 'T00:00:00Z') : null;
          const demissionDate = emp.demission_date ? new Date(emp.demission_date + 'T00:00:00Z') : null;
          return admissionDate && dataRelatorio >= admissionDate && (!demissionDate || dataRelatorio < demissionDate);
      });
        
      const savedMaoDeObra = rdoData.mao_de_obra || [];
      setEmployeePresences(activeEmployees.map(emp => {
        const savedStatus = savedMaoDeObra.find(s => s.id === emp.id);
        return { id: emp.id, name: emp.full_name, present: savedStatus?.present ?? true, observacao: savedStatus?.observacao || '' };
      }));

      const savedStatusAtividades = rdoData.status_atividades || [];
      const todayFormatted = new Date().toISOString().split('T')[0];
      const isTodayRdo = rdoData.data_relatorio === todayFormatted;

      setActivityStatuses(filteredActivities.map(dbAct => {
        const rdoActivity = savedStatusAtividades.find(sa => sa.id === dbAct.id);
        const status = isTodayRdo ? dbAct.status : (rdoActivity?.status || dbAct.status);
        const observacao = rdoActivity?.observacao || '';
        return { id: dbAct.id, nome: dbAct.nome, status, observacao };
      }));

      const photoPromises = (rdoData.rdo_fotos_uploads || []).map(async (photo) => {
        const { data } = await supabase.storage.from('rdo-fotos').createSignedUrl(photo.caminho_arquivo, 3600);
        return { ...photo, signedUrl: data?.signedUrl };
      });
      setAllPhotosMetadata(await Promise.all(photoPromises));

      // LÓGICA DE BLOQUEIO ATUALIZADA
      const isOldDate = rdoData.data_relatorio !== todayFormatted;
      const isFinalized = !!rdoData.pdf_url;
      setIsRdoLocked(isOldDate || isFinalized);

    } catch (error) {
      console.error("Erro ao carregar dados do RDO:", error);
      setMessage("Erro ao carregar os detalhes do RDO.");
    } finally {
      setLoadingForm(false);
    }
  }, [supabase, organizacaoId]);

  useEffect(() => {
    const initializeForm = async () => {
      if (!organizacaoId) {
        toast.error("Erro de segurança: A organização do usuário não foi encontrada.");
        setLoadingForm(false);
        return;
      }

      if (initialRdoData) {
        const { data: fullRdoData, error } = await supabase
          .from('diarios_obra')
          .select('*, empreendimentos(*), ocorrencias(*), rdo_fotos_uploads(*), usuarios(nome, sobrenome)')
          .eq('id', initialRdoData.id)
          .eq('organizacao_id', organizacaoId)
          .single();

        if (error) {
          console.error("Erro ao buscar dados completos do RDO:", error);
          await setupFormWithData(initialRdoData);
        } else {
          await setupFormWithData(fullRdoData);
        }
      } else if (selectedEmpreendimento) {
        setLoadingForm(true);
        const today = new Date().toISOString().split('T')[0];

        let { data: rdo, error } = await supabase
          .from('diarios_obra')
          .select('*, empreendimentos(*), ocorrencias(*), rdo_fotos_uploads(*), usuarios(nome, sobrenome)')
          .eq('empreendimento_id', selectedEmpreendimento.id)
          .eq('data_relatorio', today)
          .eq('organizacao_id', organizacaoId)
          .maybeSingle();

        if (!rdo && !error) {
          const { data: newRdo, error: insertError } = await supabase
            .from('diarios_obra')
            .insert({
              empreendimento_id: selectedEmpreendimento.id,
              data_relatorio: today,
              usuario_responsavel_id: user?.id,
              condicoes_climaticas: 'Ensolarado',
              condicoes_trabalho: 'Praticável',
              status_atividades: [],
              mao_de_obra: [],
              organizacao_id: organizacaoId,
            })
            .select('*, empreendimentos(*), ocorrencias(*), rdo_fotos_uploads(*), usuarios(nome, sobrenome)')
            .single();

          if (insertError) {
            setMessage(`Erro ao criar novo RDO: ${insertError.message}`);
            setLoadingForm(false);
            return;
          }
          rdo = newRdo;
        }

        if (rdo) {
          await setupFormWithData(rdo);
        } else {
          setLoadingForm(false);
        }
      } else {
        setLoadingForm(false);
      }
    };
    if (user) {
      initializeForm();
    }
  }, [initialRdoData, selectedEmpreendimento, supabase, setupFormWithData, user, organizacaoId]);

  const handleMarcarEntregue = async (pedidoId) => {
    if (isRdoLocked) {
      toast.warning("Este RDO está bloqueado e não pode ser alterado.");
      return;
    }
    if (!user || !organizacaoId) {
      toast.error("Usuário ou organização não autenticada. Não é possível realizar esta ação.");
      return;
    }

    const promise = async () => {
        const { error: rpcError } = await supabase.rpc('marcar_pedido_entregue', {
            p_pedido_id: pedidoId,
            p_usuario_id: user.id,
            p_organizacao_id: organizacaoId
        });
        if (rpcError) throw new Error(`Erro ao marcar como entregue: ${rpcError.message}`);

        const { error: almoxarifadoError } = await supabase.rpc('processar_entrada_pedido_no_estoque', {
            p_pedido_id: pedidoId,
            p_usuario_id: user.id,
            p_organizacao_id: organizacaoId
        });
        if (almoxarifadoError) throw new Error(`Falha ao dar entrada no estoque: ${almoxarifadoError.message}`);
        
        return pedidoId;
    };
    
    toast.promise(promise(), {
        loading: "Processando entrega do pedido...",
        success: async (id) => {
            setPedidosPrevistos(prev => prev.map(p =>
                p.id === id ? { ...p, status: 'Entregue' } : p
            ));

            const pedidoInfo = pedidosPrevistos.find(p => p.id === id);
            const tituloPedido = pedidoInfo?.titulo || '';

            await notificarGrupo({
                permissao: 'pedidos',
                titulo: '✅ Entrega Recebida no RDO',
                mensagem: `O Pedido #${id} ${tituloPedido ? `(${tituloPedido})` : ''} foi recebido e conferido pelo Diário de Obra.`,
                link: `/pedidos/${id}`,
                tipo: 'sucesso',
                organizacaoId: organizacaoId
            });

            return `Pedido #${id} recebido e estoque atualizado com sucesso!`;
        },
        error: (err) => err.message,
    });
  };

  const handleRdoFormChange = (e) => {
    if (isRdoLocked) return;
    const { name, value, type, checked } = e.target;
    setRdoFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 'Praticável' : 'Não Praticável') : value }));
  };

  const saveSectionData = useCallback(async (data) => {
    if (!rdoFormData.id || isRdoLocked || !organizacaoId) return;
    
    const promise = supabase
        .from('diarios_obra')
        .update(data)
        .eq('id', rdoFormData.id)
        .eq('organizacao_id', organizacaoId)
        .throwOnError();

    toast.promise(promise, {
        loading: 'Salvando...',
        success: 'Salvo com sucesso!',
        error: (err) => `Erro ao salvar: ${err.message}`
    });

  }, [isRdoLocked, rdoFormData.id, supabase, organizacaoId]);

  const handleActivityStatusChange = useCallback(async (activityId, newStatus, newObservation) => {
    if (isRdoLocked || !organizacaoId) return;
    
    const updatedStatuses = activityStatuses.map(act => 
        act.id === activityId ? { ...act, status: newStatus, observacao: newObservation } : act
    );
    setActivityStatuses(updatedStatuses);
    saveSectionData({ status_atividades: updatedStatuses });

    const updatePayload = { status: newStatus };
    if (newStatus === 'Concluído') {
        updatePayload.data_fim_real = new Date().toISOString().split('T')[0];
    }
    
    await supabase
        .from('activities')
        .update(updatePayload)
        .eq('id', activityId)
        .eq('organizacao_id', organizacaoId);

  }, [activityStatuses, saveSectionData, supabase, isRdoLocked, organizacaoId]);

  const handleEmployeeChange = useCallback(async (employeeId, field, value) => {
    if (isRdoLocked) return;
    const updatedPresences = employeePresences.map(emp => emp.id === employeeId ? { ...emp, [field]: value } : emp);
    setEmployeePresences(updatedPresences);
    saveSectionData({ mao_de_obra: updatedPresences });
  }, [employeePresences, saveSectionData, isRdoLocked]);

  const handleNewOccurrenceChange = (e) => {
    if (isRdoLocked) return;
    const { name, value } = e.target;
    setCurrentNewOccurrence(prev => ({ ...prev, [name]: value }));
  };

  const handleAddOccurrence = async () => {
    if (isRdoLocked || !currentNewOccurrence.descricao.trim() || !organizacaoId) {
        if(!organizacaoId) toast.error("Erro de segurança: A organização do usuário não foi encontrada.");
        return;
    }

    const promise = supabase.from('ocorrencias').insert({
      ...currentNewOccurrence,
      diario_obra_id: rdoFormData.id,
      empreendimento_id: rdoFormData.empreendimento_id,
      data_ocorrencia: new Date().toLocaleDateString('pt-BR'),
      hora_ocorrencia: new Date().toLocaleTimeString('pt-BR'),
      organizacao_id: organizacaoId,
    }).select().single().throwOnError();

    toast.promise(promise, {
        loading: 'Adicionando ocorrência...',
        success: (data) => {
            setAllOccurrences(prev => [...prev, data]);
            setCurrentNewOccurrence({ tipo: 'Informativa', descricao: '' });
            return 'Ocorrência adicionada!';
        },
        error: (err) => `Erro: ${err.message}`
    });
  };

  const handleRemoveOccurrence = async (occurrenceId) => {
    if (isRdoLocked || !organizacaoId) return;
    const promise = supabase
        .from('ocorrencias')
        .delete()
        .eq('id', occurrenceId)
        .eq('organizacao_id', organizacaoId)
        .throwOnError();

    toast.promise(promise, {
        loading: 'Removendo ocorrência...',
        success: () => {
            setAllOccurrences(prev => prev.filter(occ => occ.id !== occurrenceId));
            return 'Ocorrência removida.';
        },
        error: (err) => `Erro: ${err.message}`
    });
  };

  const handleOccurrenceChange = (occurrenceId, newDescription) => {
    if (isRdoLocked) return;
    setAllOccurrences(prev => prev.map(occ =>
      occ.id === occurrenceId ? { ...occ, descricao: newDescription } : occ
    ));
  };

  const handleSaveOccurrence = async (occurrenceId, description) => {
    if (isRdoLocked || !organizacaoId) return;
    const promise = supabase
      .from('ocorrencias')
      .update({ descricao: description })
      .eq('id', occurrenceId)
      .eq('organizacao_id', organizacaoId)
      .throwOnError();

    toast.promise(promise, {
        loading: 'Salvando ocorrência...',
        success: 'Ocorrência salva!',
        error: (err) => `Erro ao atualizar: ${err.message}`
    });
  };

  const handlePhotoFileSelect = (e) => {
    if (isRdoLocked) return;
    if (e.target.files?.[0]) setCurrentPhotoFile(e.target.files[0]);
    else setCurrentPhotoFile(null);
  };

  const handleAddPhoto = async () => {
    if (isRdoLocked || !currentPhotoFile || !organizacaoId) {
        if(!organizacaoId) toast.error("Organização não identificada.");
        return;
    }

    const promise = async () => {
        setIsUploading(true);
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        const compressedFile = await imageCompression(currentPhotoFile, options);
        const safeFileName = `${Date.now()}-${currentPhotoFile.name.replace(/\s/g, '_')}`;
        const filePath = `${rdoFormData.id}/${safeFileName}`;

        const { data: fileData, error: fileError } = await supabase.storage
            .from('rdo-fotos')
            .upload(filePath, compressedFile);
        if (fileError) throw fileError;
        
        const { data: dbData, error: dbError } = await supabase
            .from('rdo_fotos_uploads')
            .insert({
                diario_obra_id: rdoFormData.id,
                caminho_arquivo: fileData.path,
                descricao: currentPhotoDescription || null,
                tamanho_arquivo: compressedFile.size,
                organizacao_id: organizacaoId,
            })
            .select()
            .single();
        
        if (dbError) {
            await supabase.storage.from('rdo-fotos').remove([fileData.path]);
            throw dbError;
        }

        const { data: signedUrlData } = await supabase.storage.from('rdo-fotos').createSignedUrl(dbData.caminho_arquivo, 3600);
        setAllPhotosMetadata(prev => [...prev, { ...dbData, signedUrl: signedUrlData?.signedUrl }]);
        setCurrentPhotoFile(null);
        setCurrentPhotoDescription('');
        if (document.getElementById('photo-file-input')) {
            document.getElementById('photo-file-input').value = "";
        }
    };

    toast.promise(promise(), {
        loading: 'Comprimindo e enviando foto...',
        success: 'Foto adicionada com sucesso!',
        error: (err) => {
            console.error('Erro no processo de adicionar foto:', err);
            return `Erro: ${err.message}`;
        },
        finally: () => setIsUploading(false)
    });
  };

  const handleRemovePhoto = async (photoId, photoPath) => {
    if (isRdoLocked || !organizacaoId) return;
    const promise = async () => {
        await supabase.storage.from('rdo-fotos').remove([photoPath]);
        await supabase
            .from('rdo_fotos_uploads')
            .delete()
            .eq('id', photoId)
            .eq('organizacao_id', organizacaoId);
    };

    toast.promise(promise(), {
        loading: 'Removendo foto...',
        success: () => {
            setAllPhotosMetadata(prev => prev.filter(p => p.id !== photoId));
            return 'Foto removida.';
        },
        error: (err) => `Erro: ${err.message}`
    });
  };

  const sortedActivityStatuses = useMemo(() => {
    if (!Array.isArray(activityStatuses)) {
      return [];
    }
    return [...activityStatuses].sort((a, b) => {
      const statusA = (a?.status || 'Não Iniciado').trim().toLowerCase();
      const statusB = (b?.status || 'Não Iniciado').trim().toLowerCase();
      const orderA = STATUS_CONFIG[statusA]?.order || 99;
      const orderB = STATUS_CONFIG[statusB]?.order || 99;
      return orderA - orderB;
    });
  }, [activityStatuses]);

  if (loadingForm) {
    return <p className="text-center mt-10">Carregando dados do RDO...</p>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow print:shadow-none print:p-0">
      {/* CABEÇALHO COM BOTÕES DE AÇÃO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Detalhes do RDO</h2>
        
        <div className="flex gap-2 w-full md:w-auto">
            {/* BOTÃO DE RASCUNHO (Opcional) */}
            <button
                onClick={handlePrintDraft}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 flex items-center gap-2 text-sm"
            >
                <FontAwesomeIcon icon={faPrint} />
                Visualizar Rascunho
            </button>

            {/* BOTÃO INTELIGENTE: FINALIZAR OU BAIXAR */}
            {savedPdfUrl ? (
                <a 
                    href={savedPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors flex-1 md:flex-initial justify-center"
                >
                    <FontAwesomeIcon icon={faDownload} />
                    Baixar PDF Assinado
                </a>
            ) : (
                <button
                    onClick={handleFinalizeRdo}
                    disabled={isGeneratingPdf}
                    className={`bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2 shadow-sm transition-colors flex-1 md:flex-initial justify-center ${isGeneratingPdf ? 'opacity-75 cursor-wait' : ''}`}
                >
                    {isGeneratingPdf ? (
                        <>
                            <FontAwesomeIcon icon={faSpinner} spin />
                            Gerando PDF...
                        </>
                    ) : (
                        <>
                            <FontAwesomeIcon icon={faFilePdf} />
                            Finalizar e Gerar PDF
                        </>
                    )}
                </button>
            )}
        </div>
      </div>

      {isRdoLocked && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 print:hidden rounded-r-md shadow-sm" role="alert">
            <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faLock} />
                <p className="font-bold">RDO Fechado!</p>
            </div>
          <p className="text-sm mt-1">Este Diário de Obra foi finalizado ou pertence a uma data passada. Edições foram bloqueadas para manter o registro histórico.</p>
          {savedPdfUrl && (
              <p className="text-sm mt-2 font-semibold">Um documento PDF assinado já foi gerado para este dia.</p>
          )}
        </div>
      )}

      {/* FORMULÁRIO (Visível apenas na tela) */}
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6 print:hidden">
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data</label>
              <input type="date" value={rdoFormData.data_relatorio || ''} readOnly disabled className="mt-1 block w-full p-2 bg-gray-100 border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">RDO Nº</label>
              <input type="text" value={rdoFormData.rdo_numero || ''} readOnly disabled className="mt-1 block w-full p-2 bg-gray-100 border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Responsável</label>
              <p className="mt-1 p-2 bg-gray-100 rounded-md text-sm">{responsavelOriginal || 'Carregando...'}</p>
            </div>
          </div>
        </div>
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Condições Climáticas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">Condição</label>
              <select name="condicoes_climaticas" value={rdoFormData.condicoes_climaticas || ''} onChange={handleRdoFormChange} onBlur={() => saveSectionData({ condicoes_climaticas: rdoFormData.condicoes_climaticas })} disabled={isRdoLocked} className="mt-1 block w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100">
                {weatherOptions.map(option => (<option key={option} value={option}>{option}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="condicoes_trabalho" checked={rdoFormData.condicoes_trabalho === 'Praticável'} onChange={(e) => { handleRdoFormChange(e); saveSectionData({ condicoes_trabalho: e.target.checked ? 'Praticável' : 'Não Praticável' }); }} disabled={isRdoLocked} className="h-4 w-4" />
              <label className="text-sm font-medium text-gray-700">Condições Praticáveis?</label>
            </div>
          </div>
        </div>
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Entregas de Pedidos Previstas</h3>
          {pedidosPrevistos.length > 0 ? (
            <ul className="divide-y border rounded-md">
              {pedidosPrevistos.map(pedido => (
                <li key={pedido.id} className="p-3 text-sm flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FontAwesomeIcon icon={faTruck} className="text-blue-500 mt-1" />
                    <div>
                      <p className="font-semibold">Pedido de Compra #{pedido.id}</p>
                      <p className="text-xs text-gray-600">
                        {pedido.itens.map(item => item.descricao_item).join(', ')}
                      </p>
                    </div>
                  </div>
                  {pedido.status === 'Entregue' ? (
                    <span className="flex items-center gap-2 text-green-600 font-bold text-xs">
                      <FontAwesomeIcon icon={faCheckCircle} />
                      Entregue
                    </span>
                  ) : (
                    <button
                      onClick={() => handleMarcarEntregue(pedido.id)}
                      disabled={isRdoLocked}
                      className="bg-green-500 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Marcar como Entregue
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma entrega de material prevista para hoje.</p>
          )}
        </div>
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Status das Atividades</h3>
          <ul className="divide-y divide-gray-200">
            {sortedActivityStatuses.map((activity) => {
              const currentStatus = (activity.status || 'Não Iniciado').trim().toLowerCase();
              const config = STATUS_CONFIG[currentStatus] || { colorClass: 'border-l-4 border-gray-200' };

              return (
                <li key={activity.id} className={`pl-4 pr-2 py-3 flex flex-col md:flex-row md:items-center gap-2 ${config.colorClass}`}>
                  <span className="font-medium w-full md:w-2/5">{activity.nome}</span>
                  <select value={activity.status || 'Não Iniciado'} onChange={(e) => handleActivityStatusChange(activity.id, e.target.value, activity.observacao)} disabled={isRdoLocked} className="p-1 border rounded-md text-sm w-full md:w-1/5 disabled:bg-gray-100">
                    <option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option>
                  </select>
                  <input type="text" placeholder="Observação..." value={activity.observacao || ''} onChange={(e) => handleActivityStatusChange(activity.id, activity.status, e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm disabled:bg-gray-100" />
                </li>
              );
            })}
            {sortedActivityStatuses.length === 0 && (
              <p className="text-sm text-gray-500 py-2">Nenhuma atividade de obra para hoje.</p>
            )}
          </ul>
        </div>
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Mão de Obra</h3>
          <ul className="divide-y divide-gray-200">
            {employeePresences.map((employee) => (
              <li key={employee.id} className="py-3 flex flex-col md:flex-row md:items-center gap-2">
                <span className="font-medium w-full md:w-2/5">{employee.name}</span>
                <div className="flex items-center gap-2 w-full md:w-1/5">
                  <button type="button" onClick={() => handleEmployeeChange(employee.id, 'present', !employee.present)} disabled={isRdoLocked} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${employee.present ? 'bg-green-500' : 'bg-red-500'} ${isRdoLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${employee.present ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span>{employee.present ? 'Presente' : 'Faltou'}</span>
                </div>
                <input type="text" placeholder="Observação..." value={employee.observacao || ''} onChange={(e) => handleEmployeeChange(employee.id, 'observacao', e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm disabled:bg-gray-100" />
              </li>
            ))}
            {employeePresences.length === 0 && (
              <p className="text-sm text-gray-500 py-2">Nenhum funcionário ativo para esta data.</p>
            )}
          </ul>
        </div>
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Ocorrências do Dia</h3>
          {hasPermission('rdo', 'pode_criar') && !isRdoLocked && (
            <div className="flex flex-col md:flex-row gap-4 mb-3">
              <select name="tipo" value={currentNewOccurrence.tipo} onChange={handleNewOccurrenceChange} className="flex-1 block w-full p-2 border rounded-md text-sm">
                {occurrenceTypes.map(type => (<option key={type} value={type}>{type}</option>))}
              </select>
              <textarea name="descricao" value={currentNewOccurrence.descricao} onChange={handleNewOccurrenceChange} rows="1" placeholder="Descreva a ocorrência..." className="flex-grow w-full md:w-1/2 block p-2 border rounded-md text-sm"></textarea>
              <button type="button" onClick={handleAddOccurrence} disabled={!currentNewOccurrence.descricao.trim()} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400">Adicionar</button>
            </div>
          )}
          <ul className="divide-y border rounded-md">
            {allOccurrences.map((occ) => (
              <li key={occ.id} className="p-3 flex justify-between items-center gap-2 text-sm">
                <div className="flex-grow flex items-center gap-2">
                  <span className="font-semibold">{occ.tipo}:</span>
                  <input
                    type="text"
                    value={occ.descricao}
                    onChange={(e) => handleOccurrenceChange(occ.id, e.target.value)}
                    onBlur={(e) => handleSaveOccurrence(occ.id, e.target.value)}
                    disabled={isRdoLocked}
                    className="flex-grow p-1 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:border-transparent w-full"
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">({new Date(occ.created_at).toLocaleString('pt-BR')})</span>
                </div>
                {hasPermission('rdo', 'pode_excluir') && !isRdoLocked && (
                  <button type="button" onClick={() => handleRemoveOccurrence(occ.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50 text-xl font-bold">&times;</button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Fotos do Dia</h3>
          {hasPermission('rdo', 'pode_criar') && !isRdoLocked && (
            <div className="flex flex-col md:flex-row gap-4 mb-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Arquivo</label>
                <input type="file" id="photo-file-input" accept="image/*" onChange={handlePhotoFileSelect} disabled={isUploading} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100 disabled:opacity-50" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Descrição</label>
                <input type="text" value={currentPhotoDescription} onChange={(e) => setCurrentPhotoDescription(e.target.value)} placeholder="Descrição da foto..." disabled={isUploading} className="mt-1 block w-full p-2 border rounded-md text-sm" />
              </div>
              <button type="button" onClick={handleAddPhoto} disabled={!currentPhotoFile || isUploading} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400">{isUploading ? 'Enviando...' : 'Adicionar Foto'}</button>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {allPhotosMetadata.map((photo) => (
              <div key={photo.id} className="relative group border rounded-lg overflow-hidden shadow-sm">
                {photo.signedUrl ? (
                  <img src={photo.signedUrl} alt={photo.descricao || 'Foto do RDO'} className="object-cover w-full h-32" />
                ) : (
                  <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-xs text-red-500">Erro ao carregar</div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate" title={photo.descricao}>
                  {photo.descricao || "Sem descrição"}
                </div>
                {hasPermission('rdo', 'pode_excluir') && !isRdoLocked && (
                  <button type="button" onClick={() => handleRemovePhoto(photo.id, photo.caminho_arquivo)} disabled={isUploading} className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 disabled:opacity-50">&times;</button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {message && <p className="text-center mt-4 text-sm font-medium">{message}</p>}
      </form>

      {/* ================================================================================== */}
      {/* ÁREA DE IMPRESSÃO / GERAÇÃO DE PDF (O HÍBRIDO)                                     */}
      {/* ================================================================================== */}
      
      {/* OVERLAY DE CARREGAMENTO (Aparece apenas durante a geração do PDF)
          Isso esconde o "pulo" visual do relatório aparecendo na tela enquanto as imagens são processadas.
      */}
      {isGeneratingPdf && (
          <div className="fixed inset-0 bg-black/80 z-[10000] flex flex-col items-center justify-center text-white">
              <FontAwesomeIcon icon={faSpinner} spin size="3x" className="mb-4" />
              <p className="text-xl font-bold">Gerando PDF e Assinando Digitalmente...</p>
              <p className="text-sm text-gray-300">Por favor, aguarde. Convertendo imagens...</p>
          </div>
      )}

      {/* CONTAINER DO RELATÓRIO
          
          Estados:
          1. Normal (Tela): Escondido bem longe (`left-[-9999px]`).
          2. Rascunho (Ctrl+P): Classes `print:...` entram em ação. 
             - `print:block` e `print:static` garantem que apareça na folha.
          3. Gerando PDF (isGeneratingPdf=true):
             - Não usamos este container diretamente para gerar o PDF (usamos o clone).
             - Mas ele serve de "molde" para o clone.
      */}
      <div 
        className={`
            fixed top-0 left-[-9999px]
            print:left-0 print:top-0 print:z-[9999] print:w-full print:h-auto print:bg-white print:static print:block
        `}
      >
          {/* O Componente que será impresso/fotografado */}
          <RdoPrintView 
            ref={printRef}
            rdoData={rdoFormData}
            atividades={sortedActivityStatuses}
            maoDeObra={employeePresences}
            ocorrencias={allOccurrences}
            fotos={allPhotosMetadata}
            pedidos={pedidosPrevistos}
          />
      </div>

    </div>
  );
}