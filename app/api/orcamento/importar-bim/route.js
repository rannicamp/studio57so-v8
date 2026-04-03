// Caminho: app/api/orcamento/importar-bim/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Mapa de Unidades: define qual campo do JSONB usar e a unidade de cada categoria BIM
const MAPA_UNIDADES = {
 'Revit Paredes': { campo: 'Area', unidade: 'm²', relevancia: 'alta' },
 'Revit Pisos': { campo: 'Area', unidade: 'm²', relevancia: 'alta' },
 'Revit Lajes': { campo: 'Area', unidade: 'm²', relevancia: 'alta' },
 'Revit Forros': { campo: 'Area', unidade: 'm²', relevancia: 'media' },
 'Revit Coberturas': { campo: 'Area', unidade: 'm²', relevancia: 'alta' },
 'Revit Colunas': { campo: 'Volume', unidade: 'm³', relevancia: 'media' },
 'Revit Quadro estrutural': { campo: 'Comprimento', unidade: 'ml', relevancia: 'media' },
 'Revit Tubulação': { campo: 'Comprimento', unidade: 'ml', relevancia: 'media' },
 'Revit Conduites': { campo: 'Comprimento', unidade: 'ml', relevancia: 'media' },
 'Revit Portas': { campo: 'count', unidade: 'un', relevancia: 'alta' },
 'Revit Janelas': { campo: 'count', unidade: 'un', relevancia: 'alta' },
 'Revit Peças hidrossanitárias': { campo: 'count', unidade: 'un', relevancia: 'media' },
 'Revit Dispositivos elétricos': { campo: 'count', unidade: 'un', relevancia: 'media' },
 'Revit Dispositivos de iluminação': { campo: 'count', unidade: 'un', relevancia: 'media' },
 'Revit Dispositivos de segurança': { campo: 'count', unidade: 'un', relevancia: 'baixa' },
};

// Extrai o valor numérico de um campo das propriedades JSONB do elemento
function extrairQuantidade(propriedades, campo) {
 if (!propriedades || campo === 'count') return 1; // Para contagem, retorna 1 por elemento

 // Tenta várias grafias comuns do campo (PT e EN)
 const variacoes = [
 campo,
 campo.toLowerCase(),
 campo.toUpperCase(),
 `${campo} (m²)`,
 `${campo} (m³)`,
 `${campo} (m)`,
 'Área',
 'Area',
 'Volume',
 'Comprimento',
 'Length',
 'Surface Area',
 ];

 for (const variacao of variacoes) {
 const valor = propriedades[variacao];
 if (valor !== undefined && valor !== null && valor !== '') {
 const numerico = parseFloat(String(valor).replace(',', '.'));
 if (!isNaN(numerico) && numerico > 0) return numerico;
 }
 }

 return 0;
}

// Rota GET: retorna categorias disponíveis para um projeto BIM
export async function GET(request) {
 const supabase = await createClient();
 const { searchParams } = new URL(request.url);
 const projeto_bim_id = searchParams.get('projeto_bim_id');
 const organizacao_id = searchParams.get('organizacao_id');

 if (!projeto_bim_id || !organizacao_id) {
 return NextResponse.json({ error: 'projeto_bim_id e organizacao_id são obrigatórios' }, { status: 400 });
 }

 // Busca categorias distintas com contagem de elementos
 const { data, error } = await supabase
 .from('elementos_bim')
 .select('categoria')
 .eq('projeto_bim_id', projeto_bim_id)
 .eq('organizacao_id', organizacao_id)
 .eq('is_active', true);

 if (error) {
 console.error('[importar-bim GET] Erro:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }

 // Agrupa por categoria e conta
 const categoriasMap = {};
 (data || []).forEach(el => {
 const cat = el.categoria || 'Desconhecido';
 categoriasMap[cat] = (categoriasMap[cat] || 0) + 1;
 });

 // Monta resultado com relevância e infos do mapa de unidades
 const categorias = Object.entries(categoriasMap)
 .map(([nome, total]) => ({
 nome,
 total,
 unidade_sugerida: MAPA_UNIDADES[nome]?.unidade || 'un',
 relevancia: MAPA_UNIDADES[nome]?.relevancia || 'media',
 }))
 .sort((a, b) => {
 const ordem = { alta: 0, media: 1, baixa: 2 };
 return (ordem[a.relevancia] - ordem[b.relevancia]) || b.total - a.total;
 });

 return NextResponse.json({ categorias });
}

// Rota POST: agrupa elementos pelas categorias selecionadas e retorna quantidades para revisão
export async function POST(request) {
 const supabase = await createClient();

 let body;
 try {
 body = await request.json();
 } catch {
 return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
 }

 const { projeto_bim_id, categorias_selecionadas, organizacao_id, orcamento_id } = body;

 if (!projeto_bim_id || !categorias_selecionadas?.length || !organizacao_id || !orcamento_id) {
 return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 });
 }

 // Busca todos os elementos das categorias selecionadas
 const { data: elementos, error } = await supabase
 .from('elementos_bim')
 .select('id, external_id, categoria, familia, tipo, nivel, propriedades')
 .eq('projeto_bim_id', projeto_bim_id)
 .eq('organizacao_id', organizacao_id)
 .eq('is_active', true)
 .in('categoria', categorias_selecionadas);

 if (error) {
 console.error('[importar-bim POST] Erro:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }

 if (!elementos || elementos.length === 0) {
 return NextResponse.json({ grupos: [] });
 }

 // Agrupa por CATEGORIA + FAMÍLIA + TIPO e soma quantidades
 const gruposMap = {};

 elementos.forEach(el => {
 const chave = `${el.categoria}||${el.familia || 'Sem Família'}||${el.tipo || 'Sem Tipo'}`;
 const configUnidade = MAPA_UNIDADES[el.categoria] || { campo: 'count', unidade: 'un' };
 const qtd = extrairQuantidade(el.propriedades, configUnidade.campo);

 if (!gruposMap[chave]) {
 gruposMap[chave] = {
 chave,
 categoria: el.categoria,
 familia: el.familia || 'Sem Família',
 tipo: el.tipo || 'Sem Tipo',
 unidade: configUnidade.unidade,
 quantidade_calculada: 0,
 quantidade_editavel: 0, // Será igual à calculada, mas o user pode alterar
 quantidade_elementos: 0,
 external_ids: [],
 preco_unitario: 0, // O usuário preenche
 etapa_id: null, // O usuário seleciona
 incluir: true, // O usuário pode desmarcar
 };
 }

 gruposMap[chave].quantidade_calculada += qtd;
 gruposMap[chave].quantidade_editavel += qtd;
 gruposMap[chave].quantidade_elementos += 1;
 gruposMap[chave].external_ids.push(el.external_id);
 });

 // Arredonda quantidades para 2 casas decimais e ordena
 const grupos = Object.values(gruposMap)
 .map(g => ({
 ...g,
 quantidade_calculada: Math.round(g.quantidade_calculada * 100) / 100,
 quantidade_editavel: Math.round(g.quantidade_editavel * 100) / 100,
 }))
 .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.familia.localeCompare(b.familia));

 return NextResponse.json({ grupos, total_elementos: elementos.length });
}
