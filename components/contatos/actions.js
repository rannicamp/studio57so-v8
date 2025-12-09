'use server';

import { createClient } from '@/utils/supabase/server';
import { enviarNotificacao } from '@/utils/notificacoes';

// Função auxiliar para buscar dados do CNPJ (mantida)
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
        return { error: 'Erro de Configuração: Variáveis de ambiente ausentes no servidor.' };
    }

    const supabase = createClient();
    
    try {
        // 2. Verificação de Autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return { error: 'Sessão expirada. Recarregue a página.' };
        }

        // 3. Busca do ID da Organização
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
            return { error: 'Erro crítico: Organização não identificada.' };
        }

        // 4. PREPARAÇÃO E LIMPEZA DOS DADOS (O Segredo do Sucesso) 🧼
        // Separamos o que é array ou metadados do que realmente vai para a tabela contatos
        const { id, telefones, emails, created_at, updated_at, ...rawData } = formData;
        
        const dataToSave = { ...rawData };
        dataToSave.organizacao_id = organizacao_id;

        // Limpeza Específica: Removemos campos que não devem ser alterados manualmente ou não existem
        delete dataToSave.origem; // Tratado abaixo
        delete dataToSave.criado_por; // Virtual
        
        // FAXINA GERAL: Converte TODA string vazia "" em null
        // Isso resolve datas, selects opcionais, FKs vazias, tudo de uma vez.
        Object.keys(dataToSave).forEach(key => {
            if (dataToSave[key] === '' || dataToSave[key] === undefined) {
                dataToSave[key] = null;
            }
        });

        // Lógica de "Quem Criou"
        if (!isEditing) {
            dataToSave.criado_por_usuario_id = user.id;
            dataToSave.origem = formData.origem || 'Manual';
        } else {
            // Na edição, removemos explicitamente para não tentar alterar (e evitar erro de FK)
            delete dataToSave.criado_por_usuario_id;
        }

        let contatoId = isEditing ? id : null;

        // 5. OPERAÇÃO DE BANCO DE DADOS
        if (isEditing) {
            // Update
            const { error } = await supabase
                .from('contatos')
                .update(dataToSave)
                .eq('id', contatoId)
                .eq('organizacao_id', organizacao_id); // Segurança extra

            if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
        } else {
            // Insert
            const { data, error } = await supabase
                .from('contatos')
                .insert(dataToSave)
                .select('id, nome, razao_social')
                .single();
                
            if (error) throw new Error(`Erro ao criar: ${error.message}`);
            contatoId = data.id;

            // Notificação (apenas na criação)
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

        if (!contatoId) throw new Error("ID do contato perdido.");

        // 6. ATUALIZAÇÃO DE TELEFONES E EMAILS
        // Limpa arrays (filtros robustos)
        const cleanedPhones = (telefones || []).filter(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length > 0);
        const cleanedEmails = (emails || []).filter(mail => mail.email && mail.email.trim() !== '');

        // Remove antigos
        await supabase.from('telefones').delete().eq('contato_id', contatoId);
        await supabase.from('emails').delete().eq('contato_id', contatoId);

        // Insere novos telefones
        if (cleanedPhones.length > 0) {
            const phonesToInsert = cleanedPhones.map(tel => ({
                contato_id: contatoId,
                telefone: tel.telefone,
                country_code: tel.country_code || '+55',
                tipo: tel.tipo || 'Celular', // Garante tipo padrão
                organizacao_id
            }));
            const { error: phErr } = await supabase.from('telefones').insert(phonesToInsert);
            if (phErr) console.error("Erro telefones:", phErr);
        }

        // Insere novos emails
        if (cleanedEmails.length > 0) {
            const emailsToInsert = cleanedEmails.map(mail => ({
                contato_id: contatoId,
                email: mail.email.trim(),
                tipo: mail.tipo || 'Pessoal', // Garante tipo padrão
                organizacao_id
            }));
            const { error: emErr } = await supabase.from('emails').insert(emailsToInsert);
            if (emErr) console.error("Erro emails:", emErr);
        }

        return { success: true, contactId: contatoId };

    } catch (error) {
        console.error("ERRO SAVECONTACTACTION:", error);
        return { error: error.message || 'Erro interno no servidor.' };
    }
}