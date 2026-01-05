'use server';

import { createClient } from '@/utils/supabase/server';
import { enviarNotificacao } from '@/utils/notificacoes';

// --- LISTA VIP (Whitelist) ---
// Só deixamos passar para o banco o que realmente existe na tabela 'contatos'
const ALLOWED_COLUMNS = [
    'empresa_id', 'nome', 'cargo', 'address_street', 'address_number', 'address_complement',
    'cep', 'city', 'state', 'neighborhood', 'tipo_contato', 'foto_url', 'razao_social',
    'nome_fantasia', 'cnpj', 'inscricao_estadual', 'inscricao_municipal', 'responsavel_legal',
    'cpf', 'rg', 'birth_date', 'estado_civil', 'contract_role', 'admission_date',
    'demission_date', 'status', 'base_salary', 'total_salary', 'daily_value', 'payment_method',
    'pix_key', 'bank_details', 'observations', 'numero_ponto', 'nacionalidade',
    'personalidade_juridica', 'data_fundacao', 'tipo_servico_produto', 'pessoa_contato',
    'objetivo', 'is_awaiting_name_response', 'origem', 'meta_lead_id', 'meta_ad_id',
    'meta_adgroup_id', 'meta_page_id', 'meta_form_id', 'meta_created_time', 'meta_form_data',
    'organizacao_id', 'meta_ad_name', 'conjuge_id', 'regime_bens', 'meta_campaign_id',
    'meta_campaign_name', 'meta_adset_name', 'criado_por_usuario_id', 'creci', 'lixeira'
];

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

    const supabase = await createClient(); // Com await (Next.js 15)
    
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

        // 4. FILTRAGEM E LIMPEZA DOS DADOS (O Segredo do Sucesso) 🧼
        
        // Removemos o que não é coluna da tabela 'contatos' (id, arrays, timestamps)
        const { id, telefones, emails, created_at, updated_at, ...rawData } = formData;
        
        // Criamos um objeto novo APENAS com as colunas permitidas (Whitelist)
        const dataToSave = {};
        
        Object.keys(rawData).forEach(key => {
            // Se a chave estiver na nossa Lista VIP, ela entra. Se for 'email' ou 'telefone' intrusos, fica de fora.
            if (ALLOWED_COLUMNS.includes(key)) {
                // FAXINA GERAL: Converte string vazia "" em null
                const value = rawData[key];
                dataToSave[key] = (value === '' || value === undefined) ? null : value;
            }
        });

        // Garante a organização
        dataToSave.organizacao_id = organizacao_id;

        // Lógica de "Quem Criou"
        if (!isEditing) {
            dataToSave.criado_por_usuario_id = user.id;
            // Se 'origem' estiver vazio, forçamos 'Manual', desde que esteja na whitelist
            if (!dataToSave.origem) dataToSave.origem = 'Manual';
        } else {
            // Na edição, nunca alteramos quem criou
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
                .eq('organizacao_id', organizacao_id); 

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

        if (!contatoId) throw new Error("ID do contato perdido.");

        // 6. ATUALIZAÇÃO DE TELEFONES E EMAILS (COM BLINDAGEM DE DDI)
        
        // Filtra telefones
        const cleanedPhonesInput = (telefones || []).filter(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length > 0);
        const cleanedEmails = (emails || []).filter(mail => mail.email && mail.email.trim() !== '');

        // Remove antigos
        await supabase.from('telefones').delete().eq('contato_id', contatoId);
        await supabase.from('emails').delete().eq('contato_id', contatoId);

        // Insere novos telefones com DDI garantido
        if (cleanedPhonesInput.length > 0) {
            const phonesToInsert = cleanedPhonesInput.map(tel => {
                let cleanNumber = tel.telefone.replace(/\D/g, ''); 
                const ddi = (tel.country_code || '+55').replace('+', '');
                
                // SEGREDO: Se não começar com DDI, adiciona!
                if (!cleanNumber.startsWith(ddi)) {
                    cleanNumber = ddi + cleanNumber;
                }

                return {
                    contato_id: contatoId,
                    telefone: cleanNumber,
                    country_code: tel.country_code || '+55',
                    tipo: tel.tipo || 'Celular', 
                    organizacao_id
                };
            });

            const { error: phErr } = await supabase.from('telefones').insert(phonesToInsert);
            if (phErr) console.error("Erro telefones:", phErr);
        }

        // Insere novos emails
        if (cleanedEmails.length > 0) {
            const emailsToInsert = cleanedEmails.map(mail => ({
                contato_id: contatoId,
                email: mail.email.trim(),
                tipo: mail.tipo || 'Pessoal', 
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