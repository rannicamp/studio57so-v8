// components/contatos/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { getOrganizationId } from '@/utils/getOrganizationId';

// Função para buscar dados do CNPJ (mantida e melhorada)
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

// Nova Ação para Salvar/Atualizar Contato
export async function saveContactAction({ formData, isEditing }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Usuário não autenticado. Por favor, faça login novamente.' };
    }
    
    const organizacao_id = await getOrganizationId();
    if (!organizacao_id) {
        return { error: 'Não foi possível identificar a sua organização.' };
    }

    const { id, telefones, emails, ...dataToSave } = formData;
    dataToSave.organizacao_id = organizacao_id;

    if (!isEditing) {
        dataToSave.criado_por_usuario_id = user.id; // ATUALIZAÇÃO: Usando o campo correto da tabela
        dataToSave.origem = dataToSave.origem || 'Manual'; 
    } else {
        delete dataToSave.origem; 
        // Opcional: Impedir a mudança do 'criado_por' na edição
        delete dataToSave.criado_por_usuario_id;
        delete dataToSave.criado_por; // Remove o campo antigo por segurança
    }
    
    // Garantir que o campo 'criado_por' (se ainda existir no formulário) seja removido
    delete dataToSave.criado_por; 
    
    if (dataToSave.birth_date === '') dataToSave.birth_date = null;
    if (dataToSave.data_fundacao === '') dataToSave.data_fundacao = null;

    const cleanedPhones = telefones.filter(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length > 0);
    const cleanedEmails = emails.filter(mail => mail.email && mail.email.trim() !== '');

    let contatoId = isEditing ? id : null;

    try {
        if (isEditing) {
            const { error } = await supabase.from('contatos').update(dataToSave).eq('id', contatoId);
            if (error) throw error;
        } else {
            const { data, error } = await supabase.from('contatos').insert(dataToSave).select('id').single();
            if (error) throw error;
            contatoId = data.id;
        }

        if (!contatoId) throw new Error("Falha ao obter o ID do contato.");

        await Promise.all([
            supabase.from('telefones').delete().eq('contato_id', contatoId),
            supabase.from('emails').delete().eq('contato_id', contatoId)
        ]);

        if (cleanedPhones.length > 0) {
            const phonesToInsert = cleanedPhones.map(tel => ({
                contato_id: contatoId,
                telefone: tel.telefone,
                country_code: tel.country_code || '+55',
                tipo: 'Celular', // Você pode querer tornar isso dinâmico no futuro
                organizacao_id
            }));
            await supabase.from('telefones').insert(phonesToInsert).throwOnError();
        }

        if (cleanedEmails.length > 0) {
            const emailsToInsert = emails.map(mail => ({
                // AQUI ESTAVA O ERRO (contactId -> contatoId)
                contato_id: contatoId, // <-- CORRIGIDO!
                email: mail.email.trim(),
                tipo: 'Pessoal', // Você pode querer tornar isso dinâmico no futuro
                organizacao_id
            }));
            await supabase.from('emails').insert(emailsToInsert).throwOnError();
        }

        return { success: true, contactId: contatoId }; // Retorna o nome correto

    } catch (error) {
        console.error("Erro ao salvar contato:", error);
        // Agora o erro será mais específico (ex: erro de chave estrangeira)
        return { error: error.message };
    }
}