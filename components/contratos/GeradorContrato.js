"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint } from '@fortawesome/free-solid-svg-icons';

const QuadroLinha = ({ label, value }) => (
    <div className="flex border-t border-gray-200 py-1">
        <p className="w-1/3 text-sm text-gray-600">{label}:</p>
        <p className="w-2/3 text-sm font-semibold text-gray-800">{value || 'Não informado'}</p>
    </div>
);

export default function GeradorContrato({ contrato }) {

    const comprador = contrato?.contato;
    const conjuge = comprador?.dados_conjuge;
    
    // ==============================================================================================
    // AQUI ESTÁ O AJUSTE: Agora acessamos os dados da vendedora pelo caminho completo da relação.
    // ==============================================================================================
    const vendedora = contrato?.empreendimento?.empresa_proprietaria_id;

    const formatarEndereco = (entidade) => {
        if (!entidade) return 'Não informado';
        const parts = [
            entidade.address_street,
            entidade.address_number,
            entidade.neighborhood,
            entidade.city,
            entidade.state
        ].filter(Boolean); // Remove partes vazias
        return parts.join(', ').replace(/, ([A-Z]{2})$/, '/$1'); // Formata o final ", SP" para "/SP"
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in">
            <div className="print:hidden flex justify-between items-center mb-6 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">Pré-visualização do Contrato</h3>
                <button 
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPrint} />
                    Gerar PDF / Imprimir
                </button>
            </div>

            <div className="printable-area bg-white p-8 font-serif">
                <h2 className="text-center font-bold text-lg mb-4">
                    QUADRO RESUMO DO CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL URBANO
                </h2>

                <div className="border border-gray-300 p-4">
                    <h3 className="font-bold mb-2">Partes</h3>
                    
                    <div className="mb-4">
                        <p className="font-semibold text-base mb-2">Vendedora:</p>
                        <QuadroLinha label="Razão Social" value={vendedora?.razao_social} />
                        <QuadroLinha label="CNPJ" value={vendedora?.cnpj} />
                        <QuadroLinha label="Sede" value={formatarEndereco(vendedora)} />
                        <QuadroLinha label="Representante" value="RANNIERE CAMPOS MENDES" />
                    </div>

                    <div>
                        <p className="font-semibold text-base mb-2">Comprador(a):</p>
                        <QuadroLinha label="Nome Completo" value={comprador?.nome || comprador?.razao_social} />
                        
                        {comprador?.tipo_contato === 'Pessoa Física' && (
                            <>
                                <QuadroLinha label="CPF" value={comprador?.cpf} />
                                <QuadroLinha label="RG" value={comprador?.rg} />
                                <QuadroLinha label="Profissão" value={comprador?.cargo} />
                                <QuadroLinha label="Estado Civil" value={comprador?.estado_civil} />
                                <QuadroLinha label="Endereço" value={formatarEndereco(comprador)} />
                            </>
                        )}

                        {comprador?.tipo_contato === 'Pessoa Jurídica' && (
                            <>
                                <QuadroLinha label="CNPJ" value={comprador?.cnpj} />
                                <QuadroLinha label="Sede" value={formatarEndereco(comprador)} />
                                <QuadroLinha label="Sócio-Admin." value={comprador?.responsavel_legal} />
                            </>
                        )}

                        {conjuge?.nome && (
                            <div className="mt-4 pt-2 border-t border-dashed">
                                <QuadroLinha label="Nome Cônjuge" value={conjuge.nome} />
                                <QuadroLinha label="CPF Cônjuge" value={conjuge.cpf} />
                                <QuadroLinha label="Regime de Bens" value={comprador?.regime_bens} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}