// components/contatos/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
// A importação de 'enviarNotificacao' foi removida pois o Banco de Dados agora gerencia isso.

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

// Função auxiliar para buscar dados do CNPJ
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
    console.log(`🚀 [ACTION] Iniciando saveContactAction. Editando? ${isEditing}`);

    // 1. Verificação de Ambiente
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error("❌ [ACTION] Erro: Variáveis de ambiente ausentes.");
        return { error: 'Erro de Configuração: Variáveis de ambiente ausentes no servidor.' };
    }

    const supabase = await createClient();
    
    try {
        // 2. Verificação de Autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.error("❌ [ACTION] Usuário não autenticado ou erro de sessão.");
            return { error: 'Sessão expirada. Recarregue a página.' };
        }
        console.log(`👤 [ACTION] Usuário autenticado: ${user.id}`);

        // 3. Busca do ID da Organização (Segurança Extra)
        let organizacao_id = formData.organizacao_id;

        // Se não veio no form, busca no banco para garantir
        if (!organizacao_id) {
             const { data: userData } = await supabase
                .from('usuarios') 
                .select('organizacao_id')
                .eq('id', user.id)
                .maybeSingle();
            
            if (userData?.organizacao_id) {
                organizacao_id = userData.organizacao_id;
                console.log(`🏢 [ACTION] Organização recuperada do usuário: ${organizacao_id}`);
            }
        }

        if (!organizacao_id) {
            console.error("❌ [ACTION] Erro crítico: Sem Organization ID.");
            return { error: 'Erro crítico: Organização não identificada.' };
        }

        // 4. FILTRAGEM E LIMPEZA DOS DADOS (O Segredo do Sucesso) 🧼
        
        // Removemos campos especiais que não vão direto pra tabela
        const { id, telefones, emails, created_at, updated_at, ...rawData } = formData;
        
        const dataToSave = {};
        
        Object.keys(rawData).forEach(key => {
            if (ALLOWED_COLUMNS.includes(key)) {
                let value = rawData[key];
                // Tratamento especial para datas vazias
                if (key === 'birth_date' || key === 'data_fundacao') {
                    if (value === '' || value === undefined) value = null;
                } else {
                    if (value === '' || value === undefined) value = null;
                }
                dataToSave[key] = value;
            }
        });

        // Garante a organização e forca NULL se undefined
        dataToSave.organizacao_id = organizacao_id;

        // Lógica de "Quem Criou"
        if (!isEditing) {
            dataToSave.criado_por_usuario_id = user.id;
            if (!dataToSave.origem) dataToSave.origem = 'Manual';
        } else {
            // Na edição, removemos explicitamente para não tentar atualizar e tomar erro de permissão
            delete dataToSave.criado_por_usuario_id;
        }

        let contatoId = isEditing ? id : null;

        console.log(`💾 [ACTION] Tentando salvar no banco... ID: ${contatoId || 'NOVO'}`);

        // 5. OPERAÇÃO DE BANCO DE DADOS
        if (isEditing) {
            if (!contatoId) return { error: "ID do contato inválido para edição." };

            // Update
            const { error, count } = await supabase
                .from('contatos')
                .update(dataToSave)
                .eq('id', contatoId)
                .eq('organizacao_id', organizacao_id) // Segurança extra
                .select('id'); // Importante para confirmar que achou o registro

            if (error) {
                console.error("❌ [ACTION] Erro no UPDATE:", error);
                // Se for erro de permissão (403), o Supabase avisa aqui
                if (error.code === '42501' || error.message.includes('permission')) {
                     return { error: 'Permissão negada. Você pode não ter autorização para editar este contato.' };
                }
                throw new Error(`Erro ao atualizar: ${error.message}`);
            }
            
            // Se count for 0, pode ser RLS escondendo o registro
            console.log(`✅ [ACTION] Update realizado com sucesso.`);
        } else {
            // Insert
            const { data, error } = await supabase
                .from('contatos')
                .insert(dataToSave)
                .select('id, nome, razao_social')
                .single();
                
            if (error) {
                console.error("❌ [ACTION] Erro no INSERT:", error);
                throw new Error(`Erro ao criar: ${error.message}`);
            }
            contatoId = data.id;

            // A NOTIFICAÇÃO MANUAL FOI REMOVIDA DAQUI.
            // A TRIGGER DO BANCO JÁ VAI DETECTAR O INSERT E NOTIFICAR.
        }

        if (!contatoId) throw new Error("ID do contato perdido durante a operação.");

        // 6. ATUALIZAÇÃO DE TELEFONES E EMAILS
        // Filtra telefones
        const cleanedPhonesInput = (telefones || []).filter(tel => tel.telefone && tel.telefone.replace(/\D/g, '').length > 0);
        const cleanedEmails = (emails || []).filter(mail => mail.email && mail.email.trim() !== '');

        // Remove antigos (Limpeza para re-inserir)
        // Usamos try-catch aqui para não quebrar o fluxo principal se falhar
        try {
            await supabase.from('telefones').delete().eq('contato_id', contatoId);
            await supabase.from('emails').delete().eq('contato_id', contatoId);

            // Insere novos telefones
            if (cleanedPhonesInput.length > 0) {
                const phonesToInsert = cleanedPhonesInput.map(tel => {
                    let cleanNumber = tel.telefone.replace(/\D/g, ''); 
                    const ddi = (tel.country_code || '+55').replace('+', '');
                    if (!cleanNumber.startsWith(ddi)) { cleanNumber = ddi + cleanNumber; }

                    return {
                        contato_id: contatoId,
                        telefone: cleanNumber,
                        country_code: tel.country_code || '+55',
                        tipo: tel.tipo || 'Celular', 
                        organizacao_id
                    };
                });
                await supabase.from('telefones').insert(phonesToInsert);
            }

            // Insere novos emails
            if (cleanedEmails.length > 0) {
                const emailsToInsert = cleanedEmails.map(mail => ({
                    contato_id: contatoId,
                    email: mail.email.trim(),
                    tipo: mail.tipo || 'Pessoal', 
                    organizacao_id
                }));
                await supabase.from('emails').insert(emailsToInsert);
            }
        } catch (subError) {
            console.error("⚠️ [ACTION] Erro ao salvar telefones/emails (Dados principais salvos):", subError);
            // Não damos throw aqui para não cancelar o sucesso do contato
        }

        return { success: true, contactId: contatoId };

    } catch (error) {
        console.error("❌ [ACTION] ERRO FATAL NO CATCH:", error);
        return { error: error.message || 'Erro interno no servidor.' };
    }
}