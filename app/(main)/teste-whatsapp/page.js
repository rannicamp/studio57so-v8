// app/(main)/teste-whatsapp/page.js
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client' // <-- MUDANÇA 1: Usando o cliente do navegador
import { useAuth } from '@/contexts/AuthContext' // <-- MUDANÇA 2: Usando seu sistema de autenticação
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'

// =================================================================================
// FUNÇÃO DE BUSCA (igual ao padrão do seu CRM)
// =================================================================================
// O porquê: Esta função agora vive fora do componente e recebe o 'supabase' e 'organizacaoId'
// como argumentos. Ela faz a busca direta no banco de dados.
async function fetchRawMessages(supabase, organizacaoId) {
    // Se não tivermos a organização, não há o que buscar.
    if (!organizacaoId) {
        console.log("Aguardando ID da organização...");
        return [];
    }

    console.log(`Buscando mensagens para a organização ID: ${organizacaoId}`);

    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('organizacao_id', organizacaoId) // Filtro essencial
        .order('sent_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Erro na busca direta do Supabase:", error);
        throw new Error(error.message);
    }

    console.log(`Encontradas ${data.length} mensagens.`);
    return data;
}
// =================================================================================
// FIM DA FUNÇÃO DE BUSCA
// =================================================================================


export default function TesteWhatsappPage() {
    const supabase = createClient(); // Inicializa o cliente Supabase aqui
    const { user } = useAuth(); // Pega as informações do usuário logado
    const organizacaoId = user?.organizacao_id; // Pega o ID da organização do usuário

    const { data: messages, isLoading, isError, error } = useQuery({
        // A "chave" da busca agora inclui o organizacaoId
        queryKey: ['raw_whatsapp_messages', organizacaoId], 
        // A função de busca é chamada aqui, passando os parâmetros necessários
        queryFn: () => fetchRawMessages(supabase, organizacaoId),
        // A busca só será ativada quando o organizacaoId estiver disponível
        enabled: !!organizacaoId 
    });

    // O resto da página continua igual, apenas exibindo o resultado...

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500" />
                <p className="ml-4 text-lg">Carregando dados do banco...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-red-50 text-red-700">
                <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
                <p className="mt-4 text-lg font-bold">Ocorreu um Erro</p>
                <p className="mt-2">Não foi possível buscar as mensagens.</p>
                <pre className="mt-4 p-2 bg-red-100 text-sm rounded">{error.message}</pre>
            </div>
        );
    }

    if (!messages || messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8">
                <h1 className="text-2xl font-bold mb-4">Teste de Exibição - WhatsApp</h1>
                <p className="text-gray-500">Nenhuma mensagem encontrada na tabela 'whatsapp_messages' para sua organização.</p>
                <p className="text-sm text-gray-400 mt-2">(ID da Organização: {organizacaoId || 'não encontrado'})</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Teste de Exibição - Tabela "whatsapp_messages"</h1>
            <p className="mb-6 text-gray-600">
                <b>Sucesso!</b> A lista abaixo mostra os dados brutos da sua organização (ID: {organizacaoId}).
            </p>
            <div className="bg-white shadow rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conteúdo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direção</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Envio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lida?</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {messages.map((msg) => (
                            <tr key={msg.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{msg.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{msg.contato_id}</td>
                                <td className="px-6 py-4 max-w-sm truncate text-sm text-gray-900">{msg.content}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{msg.direction}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR') : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{msg.is_read ? 'Sim' : 'Não'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}