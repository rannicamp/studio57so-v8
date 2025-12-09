'use server';

import { createClient } from '@/utils/supabase/server';
import { enviarNotificacao } from '@/utils/notificacoes';

// Função auxiliar para buscar dados do CNPJ (mantida igual)
export async function buscarDadosCnpj(cnpj) {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return { error: 'CNPJ inválido.' };

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'CNPJ não encontrado.');
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
    // 1. Verificação de Ambiente
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não definidas no servidor.");
        return { error: 'Erro de Configuração: O servidor não conseguiu conectar ao banco de dados.' };
    }

    const supabase = createClient();
    
    try {
        // 2. Verificação de Autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.error("Erro de Auth na Action:", authError);
            return { error: 'Sessão expirada. Recarregue a página e faça login novamente.' };
        }

        // 3. Busca do ID da Organização (Fallbacks de segurança)
        let organizacao_id = formData.organizacao_id;

        if (!organizacao_id) {
             const { data: userData } = await supabase
                .from('usuarios') 
                .select('organizacao_id')
                .eq('id', user.id)
                .maybeSingle();
            
            if (userData?.organizacao_id) {
                organizacao_id = userData.organizacao_id;
            }
        }

        if (!organizacao_id) {
            return { error: 'Erro crítico: Não foi possível identificar sua organização.' };
        }

        // 4. LIMPEZA DE DADOS (Sanitização)
        const { id, telefones, emails, ...rawData } = formData;
        
        const dataToSave = { ...rawData };
        dataToSave.organizacao_id = organizacao_id;

        // Remove campos virtuais e redundantes
        delete dataToSave.origem; 
        delete dataToSave.criado_por; 
        
        // 5. LÓGICA DO "CRIADO POR" (A Correção Principal) 🛠️
        if (!isEditing) {
            // CRIAÇÃO: O dono é sempre quem está criando agora
            dataToSave.criado_por_usuario_id = user.id;
            dataToSave.origem = formData.origem || 'Manual';
        } else {
            // EDIÇÃO: Verificar se já existe dono
            // Precisamos consultar o banco para saber se o campo está NULL
            const { data: currentContact, error: fetchError } = await supabase
                .from('contatos')
                .select('criado_por_usuario_id')
                .eq('id', id)
                .single();
                
            if (!fetchError && currentContact) {
                if (!currentContact.criado_por_usuario_id) {
                    // SE ESTIVER VAZIO (Contato Antigo): Preenche com quem está editando agora
                    console.log("Atualizando contato antigo sem dono. Novo dono:", user.id);
                    dataToSave.criado_por_usuario_id = user.id;
                } else {
                    // SE JÁ TIVER DONO: Não mexe, remove do payload para garantir
                    delete dataToSave.criado_por_usuario_id;
                }
            } else {
                // Se der erro ao buscar, por segurança, remove o campo para não quebrar o update
                delete dataToSave.criado_por_usuario_id;
            }
        }

        // Converte strings vazias em null (Postgres não aceita "" em campos Date/FK)
        const fieldsToNullify = ['birth_date', 'data_fundacao', 'empresa_id', 'conjuge_id'];
        fieldsToNullify.forEach(field => {
            if (!dataToSave[field] || dataToSave[field] === '') {
                dataToSave[field] = null;
            }
        });

        // Limpa arrays vazios
        const cleanedPhones = (telefones || []).filter(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length > 0);
        const cleanedEmails = (emails || []).filter(mail => mail.email && mail.email.trim() !== '');

        let contatoId = isEditing ? id : null;

        // 6. OPERAÇÃO DE BANCO DE DADOS
        if (isEditing) {
            const { error } = await supabase.from('contatos').update(dataToSave).eq('id', contatoId);
            if (error) throw new Error(`Erro ao atualizar contato: ${error.message}`);
        } else {
            const { data, error } = await supabase.from('contatos').insert(dataToSave).select('id, nome, razao_social').single();
            if (error) throw new Error(`Erro ao criar contato: ${error.message}`);
            contatoId = data.id;

            // Notificação
            try {
                const nomeContato = data.nome || data.razao_social || 'Novo Contato';
                await enviarNotificacao({
                    userId: user.id,
                    titulo: "👤 Novo Contato",
                    mensagem: `${nomeContato} foi adicionado.`,
                    link: `/contatos/editar/${contatoId}`,
                    organizacaoId: organizacao_id,
                    canal: 'comercial'
                });
            } catch (ignored) {}
        }

        if (!contatoId) throw new Error("ID do contato perdido após operação.");

        // 7. ATUALIZAÇÃO DE TELEFONES E EMAILS
        await supabase.from('telefones').delete().eq('contato_id', contatoId);
        await supabase.from('emails').delete().eq('contato_id', contatoId);

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
        console.error("ERRO FATAL EM SAVECONTACTACTION:", error);
        return { error: error.message || 'Erro interno no servidor.' };
    }
}