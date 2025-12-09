'use server';

import { createClient } from '@/utils/supabase/server';
import { getOrganizationId } from '@/utils/getOrganizationId';
import { enviarNotificacao } from '@/utils/notificacoes';

// Função para buscar dados do CNPJ
export async function buscarDadosCnpj(cnpj) {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return { error: 'CNPJ inválido.' };

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'CNPJ não encontrado ou serviço indisponível.');
        }
        const data = await response.json();
        
        let responsavelLegal = data.qsa?.find(s => s.qualificacao_socio.includes('Administrador'))?.nome_socio || '';
        let inscricaoEstadual = data.inscricoes_estaduais?.find(ie => ie.ativo && ie.uf === data.uf)?.inscricao_estadual || data.inscricoes_estaduais?.[0]?.inscricao_estadual || '';

        return {
            success: true,
            data: {
                razao_social: data.razao_social,
                nome_fantasia: data.nome_fantasia,
                cep: (data.cep || '').replace(/\D/g, ''),
                address_street: data.logradouro,
                address_number: data.numero,
                address_complement: data.complemento,
                neighborhood: data.bairro,
                city: data.municipio,
                state: data.uf,
                data_fundacao: data.data_inicio_atividade,
                tipo_servico_produto: data.cnae_fiscal_descricao,
                responsavel_legal: responsavelLegal,
                inscricao_estadual: inscricaoEstadual,
                api_telefone: data.ddd_telefone_1,
                api_email: data.email,
            }
        };
    } catch (error) {
        return { error: error.message };
    }
}

// Ação Blindada para Salvar Contato
export async function saveContactAction({ formData, isEditing }) {
    const supabase = createClient();
    
    // Tratamento de erro melhorado para autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'Sessão expirada. Recarregue a página e faça login.' };
    }
    
    const organizacao_id = await getOrganizationId();
    if (!organizacao_id) {
        return { error: 'Erro crítico: Organização não identificada.' };
    }

    // 1. LIMPEZA PROFUNDA DE DADOS (Sanitização) 🧼
    // Separamos os arrays auxiliares do resto dos dados
    const { id, telefones, emails, ...rawData } = formData;
    
    // Criamos um novo objeto limpo
    const dataToSave = { ...rawData };
    dataToSave.organizacao_id = organizacao_id;

    // Removemos campos de controle que não existem no banco
    delete dataToSave.origem; 
    delete dataToSave.criado_por_usuario_id;
    delete dataToSave.criado_por;
    
    // Regra para criação x edição
    if (!isEditing) {
        dataToSave.criado_por_usuario_id = user.id;
        // Se origem veio no form, usamos, senão 'Manual'
        if (formData.origem) dataToSave.origem = formData.origem;
        else dataToSave.origem = 'Manual';
    }

    // [CRÍTICO] Converte strings vazias "" em null para campos de Data e IDs (FKs)
    // O Postgres odeia receber "" onde deveria ser um ID ou Data
    const fieldsToNullify = ['birth_date', 'data_fundacao', 'empresa_id', 'conjuge_id'];
    fieldsToNullify.forEach(field => {
        if (!dataToSave[field] || dataToSave[field] === '') {
            dataToSave[field] = null;
        }
    });

    // Limpa arrays de contatos
    const cleanedPhones = (telefones || []).filter(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length > 0);
    const cleanedEmails = (emails || []).filter(mail => mail.email && mail.email.trim() !== '');

    let contatoId = isEditing ? id : null;

    try {
        // OPERAÇÃO DE BANCO DE DADOS
        if (isEditing) {
            const { error } = await supabase.from('contatos').update(dataToSave).eq('id', contatoId);
            if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
        } else {
            const { data, error } = await supabase.from('contatos').insert(dataToSave).select('id, nome, razao_social').single();
            if (error) throw new Error(`Erro ao criar: ${error.message}`);
            contatoId = data.id;

            // Notificação (dentro de try/catch silencioso para não travar o save se falhar o push)
            try {
                const nomeContato = data.nome || data.razao_social || 'Novo Contato';
                await enviarNotificacao({
                    userId: user.id,
                    titulo: "👤 Novo Contato Cadastrado",
                    mensagem: `${nomeContato} foi adicionado à sua base.`,
                    link: `/contatos/editar/${contatoId}`,
                    organizacaoId: organizacao_id,
                    canal: 'comercial'
                });
            } catch (notifError) {
                console.error("Falha ao enviar notificação (não crítico):", notifError);
            }
        }

        if (!contatoId) throw new Error("ID do contato perdido após operação.");

        // ATUALIZAÇÃO DE TELEFONES E EMAILS
        // Primeiro removemos os antigos
        await supabase.from('telefones').delete().eq('contato_id', contatoId);
        await supabase.from('emails').delete().eq('contato_id', contatoId);

        // Inserimos os novos (USANDO OS ARRAYS LIMPOS!)
        if (cleanedPhones.length > 0) {
            const phonesToInsert = cleanedPhones.map(tel => ({
                contato_id: contatoId,
                telefone: tel.telefone,
                country_code: tel.country_code || '+55',
                tipo: 'Celular',
                organizacao_id
            }));
            const { error: phoneError } = await supabase.from('telefones').insert(phonesToInsert);
            if (phoneError) console.error("Erro ao salvar telefones:", phoneError);
        }

        if (cleanedEmails.length > 0) {
            // [CORREÇÃO] Usamos 'cleanedEmails' aqui, não 'emails'
            const emailsToInsert = cleanedEmails.map(mail => ({
                contato_id: contatoId,
                email: mail.email.trim(),
                tipo: 'Pessoal',
                organizacao_id
            }));
            const { error: emailError } = await supabase.from('emails').insert(emailsToInsert);
            if (emailError) console.error("Erro ao salvar emails:", emailError);
        }

        return { success: true, contactId: contatoId };

    } catch (error) {
        console.error("Erro CRÍTICO na Server Action:", error);
        // Retorna a mensagem limpa para o usuário ver no Toast
        return { error: error.message };
    }
}