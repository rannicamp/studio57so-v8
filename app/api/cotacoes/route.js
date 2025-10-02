// Local do Arquivo: app/api/cotacoes/route.js

import { NextResponse } from 'next/server';

// ##### 1. LISTA DE MOEDAS EXPANDIDA #####
// Lista com as principais moedas do mundo.
const supportedCurrencies = [
    { id: 'USD', name: 'Dólar Americano', type: 'currency' },
    { id: 'EUR', name: 'Euro', type: 'currency' },
    { id: 'GBP', name: 'Libra Esterlina', type: 'currency' },
    { id: 'JPY', name: 'Iene Japonês', type: 'currency' },
    { id: 'CAD', name: 'Dólar Canadense', type: 'currency' },
    { id: 'AUD', name: 'Dólar Australiano', type: 'currency' },
    { id: 'CHF', name: 'Franco Suíço', type: 'currency' },
    { id: 'CNY', name: 'Yuan Chinês', type: 'currency' },
    { id: 'ARS', name: 'Peso Argentino', type: 'currency' },
    { id: 'BTC', name: 'Bitcoin', type: 'currency' },
    { id: 'ETH', name: 'Ethereum', type: 'currency' },
];

// ##### 2. LISTA DE COMMODITIES EXPANDIDA #####
// Lista de commodities disponíveis na API Ninjas.
const supportedCommodities = [
    { id: 'lumber', name: 'Madeira (Lumber)', type: 'commodity' },
    { id: 'aluminum', name: 'Alumínio', type: 'commodity' },
    { id: 'brent_crude_oil', name: 'Petróleo (Brent)', type: 'commodity' },
    { id: 'coal', name: 'Carvão', type: 'commodity' },
    { id: 'cocoa', name: 'Cacau', type: 'commodity' },
    { id: 'coffee', name: 'Café', type: 'commodity' },
    { id: 'copper', name: 'Cobre', type: 'commodity' },
    { id: 'corn', name: 'Milho', type: 'commodity' },
    { id: 'cotton', name: 'Algodão', type: 'commodity' },
    { id: 'gold', name: 'Ouro', type: 'commodity' },
    { id: 'iron_ore', name: 'Minério de Ferro', type: 'commodity' },
    { id: 'natural_gas', name: 'Gás Natural', type: 'commodity' },
    { id: 'nickel', name: 'Níquel', type: 'commodity' },
    { id: 'silver', name: 'Prata', type: 'commodity' },
    { id: 'soybeans', name: 'Soja', type: 'commodity' },
    { id: 'sugar', name: 'Açúcar', type: 'commodity' },
    { id: 'wheat', name: 'Trigo', type: 'commodity' },
    { id: 'zinc', name: 'Zinco', type: 'commodity' },
];

// Cache simples em memória para evitar chamar as APIs externas toda hora
const cache = {
    data: null,
    lastFetched: 0,
};
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutos

export async function GET() {
    const now = Date.now();
    if (cache.data && (now - cache.lastFetched < CACHE_DURATION)) {
        return NextResponse.json(cache.data);
    }

    try {
        const currencyApiKey = process.env.EXCHANGERATE_API_KEY;
        if (!currencyApiKey) throw new Error('Chave da API de Moedas não encontrada.');
        
        const currencyUrl = `https://v6.exchangerate-api.com/v6/${currencyApiKey}/latest/BRL`;
        const currencyResponse = await fetch(currencyUrl);
        if (!currencyResponse.ok) {
            console.error('Erro ao buscar cotações de moedas:', await currencyResponse.text());
            throw new Error('Falha ao buscar cotações de moedas');
        }
        const currencyData = await currencyResponse.json();
        const BRL_RATES = currencyData.conversion_rates;

        const currencyResults = supportedCurrencies.map(currency => ({
            id: currency.id,
            name: currency.name,
            value: (1 / (BRL_RATES[currency.id] || 1)).toFixed(2),
            type: 'currency'
        }));

        const commodityApiKey = process.env.APININJAS_API_KEY;
        if (!commodityApiKey) throw new Error('Chave da API de Commodities não encontrada.');

        const commodityResults = await Promise.all(
            supportedCommodities.map(async (commodity) => {
                const commodityUrl = `https://api.api-ninjas.com/v1/commodityprice?name=${commodity.id}`;
                const commodityResponse = await fetch(commodityUrl, {
                    headers: { 'X-Api-Key': commodityApiKey },
                });
                if (!commodityResponse.ok) {
                    console.error(`Erro ao buscar cotação de ${commodity.name}:`, await commodityResponse.text());
                    return { id: commodity.id, name: commodity.name, value: 'N/A', type: 'commodity' };
                }
                const commodityData = await commodityResponse.json();
                const price = commodityData.length > 0 ? commodityData[0].price : 'N/A';
                return { id: commodity.id, name: commodity.name, value: price, type: 'commodity' };
            })
        );
        
        const allData = [...currencyResults, ...commodityResults];
        
        cache.data = allData;
        cache.lastFetched = now;

        return NextResponse.json(allData);

    } catch (error) {
        console.error('Erro geral na API de cotações:', error.message);
        return NextResponse.json({ error: 'Não foi possível buscar os dados de cotação.' }, { status: 500 });
    }
}