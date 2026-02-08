// components/contratos/CaracterizacaoSimplesTermo.js
"use client";

import React from 'react';

// Função auxiliar para formatar o endereço com os nomes CORRETOS
const formatarEndereco = (contato) => {
    if (!contato) {
        return '__________________________________________';
    }

    // --- CORREÇÃO AQUI ---
    const logradouro = contato.address_street || '___________________________';
    const numero = contato.address_number || '___';
    // Adiciona o complemento APENAS se ele existir
    const complemento = contato.address_complement ? `, ${contato.address_complement}` : '';
    const cidade = contato.city || '__________________';
    const uf = contato.state || '__';
    // --- FIM DA CORREÇÃO ---

    // Monta o endereço
    return `${logradouro}, ${numero}${complemento}. - ${cidade} - ${uf}`;
};

// Função auxiliar para listar as unidades (mantida)
const formatarUnidades = (produtos) => {
    if (!produtos || produtos.length === 0) {
        return '__________________';
    }
    return produtos.map(p => p.unidade || 'N/A').join(', ');
};

export default function CaracterizacaoSimplesTermo({ contrato }) {
    const contato = contrato?.contato;
    const produtos = contrato?.produtos;

    const nome = contato?.nome || contato?.razao_social || '___________________________';
    // --- CORREÇÃO AQUI (usando 'cpf' primeiro, depois 'cpf_cnpj' como fallback) ---
    const cpf = contato?.cpf || contato?.cpf_cnpj || '___________________________';
    // --- FIM DA CORREÇÃO ---
    const enderecoFormatado = formatarEndereco(contato);
    const telefone = contato?.telefones?.[0]?.telefone || '___________________________';
    const email = contato?.emails?.[0]?.email || '___________________________';
    const unidadesTexto = formatarUnidades(produtos);

    return (
        <div className="font-serif text-justify">
            <h2 className="text-center font-bold text-lg print:text-base mb-6 uppercase">
                TERMO DE INTERESSE
            </h2>
            <p className="leading-relaxed print:text-sm" style={{ textIndent: '2em' }}>
                Eu, <strong>{nome}</strong>,
                portador do CPF nº <strong>{cpf}</strong>,
                residente e domiciliado em {enderecoFormatado}.
                Tel.(whatsapp): {telefone},
                e-mail: {email}.
                declaro interesse na aquisição da(s) unidade(s) <strong>{unidadesTexto}</strong>.
            </p>
        </div>
    );
}