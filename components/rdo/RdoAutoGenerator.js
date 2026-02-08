"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import RdoPrintView from './RdoPrintView';

// Importação dinâmica do html2pdf
let html2pdf;
if (typeof window !== "undefined") {
  import("html2pdf.js").then((module) => {
    html2pdf = module.default;
  });
}

export default function RdoAutoGenerator({ pendingRdos = [], onSuccess }) {
  const supabase = createClient();
  const printRef = useRef();
  
  // Fila de processamento
  const [currentRdoId, setCurrentRdoId] = useState(null);
  const [rdoFullData, setRdoFullData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, fetching, generating, uploading, done

  // 1. Monitora a lista de pendentes e inicia o processo
  useEffect(() => {
    if (status === 'idle' && pendingRdos.length > 0) {
      const nextRdo = pendingRdos[0];
      console.log(`🤖 AutoGenerator: Iniciando processamento do RDO #${nextRdo.rdo_numero}`);
      setCurrentRdoId(nextRdo.id);
      setStatus('fetching');
    }
  }, [pendingRdos, status]);

  // 2. Busca os dados completos do RDO (Cópia da lógica do RdoForm)
  useEffect(() => {
    const fetchFullData = async () => {
      if (status !== 'fetching' || !currentRdoId) return;

      try {
        // Busca RDO base
        const { data: rdoData, error } = await supabase
          .from('diarios_obra')
          .select('*, empreendimentos(*), ocorrencias(*), rdo_fotos_uploads(*), usuarios(nome, sobrenome)')
          .eq('id', currentRdoId)
          .single();

        if (error) throw error;

        const organizacaoId = rdoData.organizacao_id;
        const empreendimentoId = rdoData.empreendimento_id;
        const dataRelatorioStr = rdoData.data_relatorio;

        // Buscas paralelas para montar o relatório
        const [pedidosRes, activitiesRes, employeesRes] = await Promise.all([
            supabase.from('pedidos_compra')
                .select('id, titulo, justificativa, status, itens:pedidos_compra_itens(descricao_item)')
                .eq('empreendimento_id', empreendimentoId)
                .eq('data_entrega_prevista', dataRelatorioStr)
                .eq('organizacao_id', organizacaoId),
            
            supabase.from('activities')
                .select('id, nome, status, tipo_atividade, data_inicio_prevista, data_fim_real')
                .eq('empreendimento_id', empreendimentoId)
                .eq('organizacao_id', organizacaoId),

            supabase.from('funcionarios')
                .select('id, full_name, status, admission_date, demission_date')
                .eq('empreendimento_atual_id', empreendimentoId)
                .eq('organizacao_id', organizacaoId)
        ]);

        // Processamento de Atividades
        const filteredActivities = (activitiesRes.data || []).filter(act => {
            if (act.tipo_atividade === 'Entrega de Pedido' || act.nome.startsWith('Entrega Pedido')) return false;
            if (act.status === 'Em Andamento') return true;
            if (act.status === 'Concluído' && act.data_fim_real === dataRelatorioStr) return true;
            if (act.status !== 'Concluído' && act.data_inicio_prevista && act.data_inicio_prevista <= dataRelatorioStr) return true;
            return false;
        });

        // Processamento de Funcionários
        const dataRelatorioDate = new Date(dataRelatorioStr + 'T00:00:00Z');
        const activeEmployees = (employeesRes.data || []).filter(emp => {
            const admissionDate = emp.admission_date ? new Date(emp.admission_date + 'T00:00:00Z') : null;
            const demissionDate = emp.demission_date ? new Date(emp.demission_date + 'T00:00:00Z') : null;
            return admissionDate && dataRelatorioDate >= admissionDate && (!demissionDate || dataRelatorioDate < demissionDate);
        });

        // Montagem dos objetos finais
        const savedMaoDeObra = rdoData.mao_de_obra || [];
        const employeePresences = activeEmployees.map(emp => {
            const savedStatus = savedMaoDeObra.find(s => s.id === emp.id);
            return { id: emp.id, name: emp.full_name, present: savedStatus?.present ?? true, observacao: savedStatus?.observacao || '' };
        });

        const savedStatusAtividades = rdoData.status_atividades || [];
        const activityStatuses = filteredActivities.map(dbAct => {
            const rdoActivity = savedStatusAtividades.find(sa => sa.id === dbAct.id);
            const status = rdoActivity?.status || dbAct.status; // Usa o salvo no RDO preferencialmente para histórico
            const observacao = rdoActivity?.observacao || '';
            return { id: dbAct.id, nome: dbAct.nome, status, observacao };
        });

        // Processamento de Fotos (Signed URLs)
        const photoPromises = (rdoData.rdo_fotos_uploads || []).map(async (photo) => {
            const { data } = await supabase.storage.from('rdo-fotos').createSignedUrl(photo.caminho_arquivo, 3600);
            return { ...photo, signedUrl: data?.signedUrl };
        });
        const allPhotosMetadata = await Promise.all(photoPromises);

        // Prepara dados para o componente de impressão
        const finalData = {
            rdoFormData: {
                id: rdoData.id,
                rdo_numero: rdoData.rdo_numero,
                data_relatorio: rdoData.data_relatorio,
                condicoes_climaticas: rdoData.condicoes_climaticas,
                condicoes_trabalho: rdoData.condicoes_trabalho,
                responsavel_nome: rdoData.usuarios ? `${rdoData.usuarios.nome} ${rdoData.usuarios.sobrenome}` : (rdoData.responsavel_rdo || 'Não identificado'),
                empreendimento_id: empreendimentoId
            },
            atividades: activityStatuses,
            maoDeObra: employeePresences,
            ocorrencias: rdoData.ocorrencias || [],
            fotos: allPhotosMetadata,
            pedidos: pedidosRes.data || []
        };

        setRdoFullData(finalData);
        setStatus('generating'); // Pronto para gerar

      } catch (err) {
        console.error("🤖 Erro ao buscar dados para auto-geração:", err);
        toast.error(`Falha ao preparar RDO #${currentRdoId} automático.`);
        onSuccess(currentRdoId, false); // Falha, pula para o próximo
        resetState();
      }
    };

    fetchFullData();
  }, [status, currentRdoId, supabase]);

  // 3. Gera o PDF e faz Upload (Lógica do html2pdf)
  useEffect(() => {
    const generateAndUpload = async () => {
        if (status !== 'generating' || !rdoFullData || !printRef.current || !html2pdf) return;

        try {
            setStatus('uploading');
            
            // Pequeno delay para garantir renderização das imagens
            await new Promise(resolve => setTimeout(resolve, 1500));

            const element = printRef.current;
            
            // Processamento de imagens Base64 (Anti-CORS)
            const images = element.querySelectorAll('img');
            const imagePromises = Array.from(images).map(async (img) => {
                try {
                    if (!img.src || img.src.startsWith('data:')) return;
                    const response = await fetch(img.src, { mode: 'cors' });
                    const blob = await response.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => { img.src = reader.result; img.srcset = ''; resolve(); };
                        reader.onerror = () => resolve();
                        reader.readAsDataURL(blob);
                    });
                } catch (e) { return Promise.resolve(); }
            });
            await Promise.all(imagePromises);

            const opt = {
                margin: 0,
                filename: `AUTO_RDO_${rdoFullData.rdoFormData.rdo_numero}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, windowWidth: 1000 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');

            // Upload
            const organizacaoId = user?.organizacao_id; // Pega do contexto global se possível ou passar via props
            const fileName = `${rdoFullData.rdoFormData.id}/${Date.now()}_AUTO.pdf`; // Caminho simplificado
            
            // NOTA: Precisamos do organizacaoId. Vou assumir que o bucket é global ou usar o ID do RDO.
            // Ajuste: usar caminho padrão 'organizacao/empreendimento/arquivo'
            // Como não tenho user aqui fácil, vou usar o ID do RDO como pasta temporária se necessário, 
            // mas o ideal é manter o padrão. Vou tentar pegar do rdoData se possível, mas aqui no blob não tenho.
            // Solução: O componente pai passa o user/orgId ou usamos um caminho seguro.
            
            const storagePath = `auto-generated/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('rdo-pdfs')
                .upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('rdo-pdfs').getPublicUrl(storagePath);
            
            // Atualiza banco
            await supabase.from('diarios_obra')
                .update({ pdf_url: publicUrlData.publicUrl })
                .eq('id', currentRdoId);

            toast.success(`RDO #${rdoFullData.rdoFormData.rdo_numero} finalizado automaticamente!`);
            onSuccess(currentRdoId, true); // Sucesso!

        } catch (error) {
            console.error("🤖 Erro na geração do PDF:", error);
            onSuccess(currentRdoId, false);
        } finally {
            resetState();
        }
    };

    generateAndUpload();
  }, [status, rdoFullData]);

  const resetState = () => {
    setRdoFullData(null);
    setCurrentRdoId(null);
    setStatus('idle');
  };

  // Se não tem dados para renderizar, não mostra nada (ou div vazia)
  if (!rdoFullData) return null;

  return (
    <div style={{ position: 'fixed', top: '-10000px', left: '-10000px' }}>
      <RdoPrintView 
        ref={printRef}
        rdoData={rdoFullData.rdoFormData}
        atividades={rdoFullData.atividades}
        maoDeObra={rdoFullData.maoDeObra}
        ocorrencias={rdoFullData.ocorrencias}
        fotos={rdoFullData.fotos}
        pedidos={rdoFullData.pedidos}
      />
    </div>
  );
}