// app/api/versiculo/route.js
import { NextResponse } from 'next/server';

// Sua chave da API (o ideal seria estar em .env, mas aqui funciona)
const API_KEY = 'c-PqZyMrP0fiqjWRl2cyk';
const BASE_URL = 'https://api.scripture.api.bible/v1';
// ID da Bíblia em Português (Almeida Revista e Atualizada ou similar disponível na API)
// '90799bb5b996fddc-01' é uma versão comum em PT-BR (Bíblia Livre).
const BIBLE_ID = '90799bb5b996fddc-01'; 

export async function GET() {
  try {
    // 1. Sorteia um versículo aleatório
    // Como a API não tem endpoint "random", vamos fazer uma "gambiarra técnica" elegante:
    // Sorteamos um livro, capítulo e versículo nós mesmos.
    
    // Lista simplificada de livros (IDs da API)
    const books = ['GEN', 'EXO', 'PSA', 'PRO', 'ISA', 'MAT', 'MRK', 'LUK', 'JHN', 'ROM', 'PHP'];
    const randomBook = books[Math.floor(Math.random() * books.length)];
    
    // Pega os capítulos do livro
    const chaptersRes = await fetch(`${BASE_URL}/bibles/${BIBLE_ID}/books/${randomBook}/chapters`, {
        headers: { 'api-key': API_KEY }
    });
    const chaptersData = await chaptersRes.json();
    const chapters = chaptersData.data.filter(c => c.number !== 'intro');
    const randomChapter = chapters[Math.floor(Math.random() * chapters.length)].id;

    // Pega os versículos do capítulo
    const versesRes = await fetch(`${BASE_URL}/bibles/${BIBLE_ID}/chapters/${randomChapter}/verses`, {
        headers: { 'api-key': API_KEY }
    });
    const versesData = await versesRes.json();
    const verses = versesData.data;
    const randomVerseId = verses[Math.floor(Math.random() * verses.length)].id;

    // Pega O TEXTO do versículo final
    const textRes = await fetch(`${BASE_URL}/bibles/${BIBLE_ID}/verses/${randomVerseId}?content-type=text`, {
        headers: { 'api-key': API_KEY }
    });
    const textData = await textRes.json();

    if (!textData.data) throw new Error('Dados não encontrados');

    return NextResponse.json({
      texto: textData.data.content.trim(), // Remove espaços extras
      referencia: textData.data.reference,
      versao: 'API Oficial'
    });

  } catch (error) {
    console.error('Erro na API Bible:', error);
    // Retorna erro 500 para o frontend usar o fallback offline
    return NextResponse.json({ error: 'Falha ao buscar versículo' }, { status: 500 });
  }
}