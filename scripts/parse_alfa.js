const fs = require('fs');

try {
    const data = fs.readFileSync('.agents/residencial_alfa/dados_brutos.md', 'utf8');
    
    // Extrai o bloco de produtos_empreendimento
    const produtosMatch = data.match(/## Tabela: produtos_empreendimento \(\d+ registros\)\n```json\n([\s\S]*?)\n```/);
    const configMatch = data.match(/## Tabela: configuracoes_venda \(\d+ registros\)\n```json\n([\s\S]*?)\n```/);
    
    let produtos = [];
    if (produtosMatch) {
        produtos = JSON.parse(produtosMatch[1]);
    }
    
    let configVenda = [];
    if (configMatch) {
        configVenda = JSON.parse(configMatch[1]);
    }
    
    console.log("=== ANÁLISE DE PRODUTOS ===");
    const isDisp = s => s.startsWith('Dispon');
    const disponiveis = produtos.filter(p => isDisp(p.status));
    const vendidos = produtos.filter(p => p.status === 'Vendido');
    const reservados = produtos.filter(p => p.status === 'Reservado');
    
    console.log(`Total de Unidades: ${produtos.length}`);
    console.log(`Disponíveis: ${disponiveis.length}`);
    console.log(`Vendidas: ${vendidos.length}`);
    console.log(`Reservadas: ${reservados.length}`);
    
    if (disponiveis.length > 0) {
        const precos = disponiveis.map(p => parseFloat(p.valor_venda_calculado || 0));
        const tamanhos = disponiveis.map(p => parseFloat(p.area_m2 || 0)).filter(t => t > 0);
        
        console.log(`Menor Preço Disponível: R$ ${Math.min(...precos).toLocaleString('pt-BR')}`);
        console.log(`Maior Preço Disponível: R$ ${Math.max(...precos).toLocaleString('pt-BR')}`);
        if(tamanhos.length > 0) {
            console.log(`Área Privativa Variação: ${Math.min(...tamanhos)}m² a ${Math.max(...tamanhos)}m²`);
        }
        
        console.log("\nUnidades Disponíveis:");
        disponiveis.slice(0, 10).forEach(p => {
            console.log(`- ${p.unidade} (${p.tipo}) - R$ ${parseFloat(p.valor_venda_calculado).toLocaleString('pt-BR')} | Área: ${p.area_m2}m²`);
        });
        if(disponiveis.length > 10) console.log(`... e mais ${disponiveis.length - 10} unidades.`);
    }

    console.log("\n=== CONFIGURAÇÕES DE VENDA ===");
    if(configVenda.length > 0) {
        const conf = configVenda[0];
        console.log(`Entrada %: ${conf.entrada_percentual}% em ${conf.num_parcelas_entrada}x`);
        console.log(`Parcelas Obra %: ${conf.parcelas_obra_percentual}% em ${conf.num_parcelas_obra}x`);
        console.log(`Saldo Remanescente %: ${conf.saldo_remanescente_percentual}%`);
    } else {
        console.log("Nenhuma configuração de venda encontrada.");
    }
    
} catch (e) {
    console.error("Erro ao analisar dados:", e);
}
