export default function TutorialNotificacoes() {
    return (
        <div className="space-y-6">
            <p className="text-lg leading-relaxed text-gray-700">
                O Studio 57 possui um motor inteligente de alertas automáticos. Sempre que um evento importante acontece (Ex: "Novo Lead Cadastrado" ou "Contas a Pagar"), a Matriz (Elo 57) disponibiliza um <strong>Template de Notificação</strong> para todas as franquias.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 p-5 rounded-lg flex gap-4">
                <div className="text-2xl">⚠️</div>
                <div>
                    <h3 className="text-yellow-800 font-bold mb-2">Atenção: Configuração Obrigatória</h3>
                    <p className="text-yellow-700 text-sm">
                        Mesmo que a Matriz crie o alerta, <strong>ele inicialmente vem DESLIGADO</strong> na sua agência. Isso ocorre para evitar que seus colaboradores recebam alertas que não condizem com o fluxo da sua cultura ou franquia. É o papel do seu gerente ativar e configurar legalmente quem recebe.
                    </p>
                </div>
            </div>

            <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2">Passo a Passo para Ativar um Alerta</h3>
            
            <div className="space-y-6">
                <div className="flex gap-4 items-start">
                    <div className="bg-rose-100 text-rose-700 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-1 shadow-sm">1</div>
                    <div>
                        <h4 className="font-bold text-gray-800">Acesse o Painel de Notificações</h4>
                        <p className="text-gray-600 text-sm mt-1">
                            Vá em <span className="bg-gray-100 px-2 py-1 rounded text-gray-800 font-mono text-xs border">Configurações &gt; Notificações Automáticas</span>. Lá você verá todas as regras agrupadas por módulo de sistema (Ex: CRM, Financeiro, Obras, Contratos).
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 items-start">
                    <div className="bg-rose-100 text-rose-700 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-1 shadow-sm">2</div>
                    <div>
                        <h4 className="font-bold text-gray-800">Ligue o botão principal (Switch)</h4>
                        <p className="text-gray-600 text-sm mt-1">
                            Encontre a regra que você deseja utilizar e clique no botão chave de <strong>"Ativar"</strong>. A regra deixará de ficar esbranquiçada e passará a ter eficácia ativa na sua franquia.
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 items-start bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                    <div className="bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-1 shadow-sm">3</div>
                    <div>
                        <h4 className="font-bold text-gray-800">Defina "Quem Vai Receber?" (Cargos)</h4>
                        <p className="text-gray-600 text-sm mt-1">
                            Esse é o passo <strong>mais importante de todos!</strong> Após habilitar a regra, clique no campo escrito "Para quem enviar?". Um menu com todas as <em>Funções</em> cadastradas da sua franquia abrirá (Ex: Corretor, Auxiliar, Gerente de Vendas).
                            <br/><br/>
                            Selecione as pessoas desejadas e aguarde o Salvamento Mágico aparecer. 
                            <strong>Se você pular essa etapa e não marcar ninguém, o sistema não saberá para quem apitar, e a notificação se perderá no vácuo!</strong>
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl mt-8 flex gap-4">
                <div className="text-3xl text-blue-500">💡</div>
                <div>
                    <h3 className="text-blue-800 font-bold mb-2">O Poder dos Links Inteligentes (Deep Links)</h3>
                    <p className="text-blue-700 text-sm">
                        A Matriz configura atalhos invisíveis junto com os avisos! Isso significa que, ao receber uma notificação de Chat ou no sininho superior, ao clicar, você (ou seu corretor) será redirecionado <strong>diretamente para a Conversa exata</strong>, para o Lead no Kanban, ou para o Documento específico. Desfrute dessa tecnologia que zera o tempo de ficar procurando as coisas manualmente pelas abas!
                    </p>
                </div>
            </div>
        </div>
    );
}
