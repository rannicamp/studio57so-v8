'use client';

import React from 'react';
import { Document, Page, View, Text, Image, Font, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer';

// ============================================================
// REGISTRO DE FONTES
// ============================================================
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: '/fonts/Montserrat-Light.ttf', fontWeight: 300 },
    { src: '/fonts/Montserrat-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Montserrat-Medium.ttf', fontWeight: 500 },
    { src: '/fonts/Montserrat-Bold.ttf', fontWeight: 700 },
    { src: '/fonts/Montserrat-Black.ttf', fontWeight: 900 },
  ],
});

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Light.ttf', fontWeight: 300 },
    { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 },
  ],
});

// ============================================================
// CONSTANTES
// ============================================================
const COLORS = {
  bg: '#0a0a0a',
  bgCard: '#161616',
  accent: '#f25a2f',
  white: '#ffffff',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
};

const PAGE_SIZE = [841.89, 595.28]; // A4 Landscape em pontos

// ============================================================
// ESTILOS
// ============================================================
const s = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    width: PAGE_SIZE[0],
    height: PAGE_SIZE[1],
    position: 'relative',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});

// ============================================================
// COMPONENTE: GRADIENTE SVG (Overlay)
// ============================================================
const GradientOverlay = ({ id, x1, y1, x2, y2, stops }) => (
  <Svg style={s.gradientOverlay}>
    <Defs>
      <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
        {stops.map((st, i) => (
          <Stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity} />
        ))}
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
  </Svg>
);

// ============================================================
// PÁGINA 1: CAPA
// ============================================================
const PaginaCapa = () => (
  <Page size={PAGE_SIZE} style={s.page}>
    {/* Camada 1: Imagem de fundo */}
    <Image src="/render_fachada.jpeg" style={s.bgImage} />
    
    {/* Camada 2: Escurecimento da esquerda (View simples com cor) */}
    <View style={{ position: 'absolute', top: 0, left: 0, width: '55%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)' }} />
    
    {/* Camada 3: Conteúdo (texto + logo) - renderiza por último = fica na frente */}
    <View style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', justifyContent: 'center', paddingLeft: 70 }}>
      <Text style={{ fontFamily: 'Montserrat', fontSize: 9, color: COLORS.gray300, letterSpacing: 8, textTransform: 'uppercase', fontWeight: 300, marginBottom: 12, textAlign: 'center' }}>
        PRÉ - LANÇAMENTO
      </Text>
      <Image
        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png"
        style={{ width: 320, height: 120, objectFit: 'contain', marginBottom: 4 }}
      />
      <Text style={{ fontFamily: 'Montserrat', fontSize: 8, color: COLORS.gray300, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center' }}>
        ALTO ESPLANADA • GOVERNADOR VALADARES
      </Text>
    </View>
  </Page>
);

// ============================================================
// PÁGINA 2: ARQUITETURA FINANCEIRA
// ============================================================
const PaginaFinanceira = () => (
  <Page size={PAGE_SIZE} style={s.page}>
    <GradientOverlay
      id="finGrad"
      x1="50%" y1="0%" x2="50%" y2="100%"
      stops={[
        { offset: '0%', color: COLORS.accent, opacity: 0.05 },
        { offset: '50%', color: COLORS.bg, opacity: 0 },
      ]}
    />
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 70 }}>
      <View style={{ alignItems: 'center', marginBottom: 50 }}>
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          <Text style={{ fontFamily: 'Roboto', fontSize: 30, fontWeight: 300, color: COLORS.gray400, letterSpacing: 4 }}>Arquitetura </Text>
          <Text style={{ fontFamily: 'Roboto', fontSize: 30, fontWeight: 700, color: COLORS.white, letterSpacing: 4 }}>Financeira</Text>
        </View>
        <Text style={{ fontFamily: 'Montserrat', fontSize: 10, color: COLORS.gray400, letterSpacing: 1 }}>
          Você não precisa se descapitalizar. Um investimento inteligente para o seu futuro.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 60 }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Montserrat', fontSize: 10, fontWeight: 700, color: COLORS.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Apenas</Text>
          <Text style={{ fontFamily: 'Montserrat', fontSize: 64, fontWeight: 300, color: COLORS.white, letterSpacing: -2 }}>20%</Text>
          <Text style={{ fontFamily: 'Montserrat', fontSize: 9, color: COLORS.gray400, letterSpacing: 2, textTransform: 'uppercase' }}>de Entrada</Text>
        </View>
        <View style={{ width: 1, height: 90, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Montserrat', fontSize: 10, fontWeight: 700, color: COLORS.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>A partir de</Text>
          <Text style={{ fontFamily: 'Montserrat', fontSize: 64, fontWeight: 300, color: COLORS.white, letterSpacing: -2 }}>R$ 1.800</Text>
          <Text style={{ fontFamily: 'Montserrat', fontSize: 9, color: COLORS.gray400, letterSpacing: 2, textTransform: 'uppercase' }}>Parcelas Mensais</Text>
        </View>
      </View>
    </View>
    <View style={{ position: 'absolute', bottom: 30, left: 0, right: 0, paddingHorizontal: 50 }}>
      <Text style={{ fontFamily: 'Montserrat', fontSize: 5, color: COLORS.gray600, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.6 }}>
        * Valores referenciais de pré-lançamento sujeitos a alteração sem aviso prévio. Consulte sempre a Studio 57.
      </Text>
    </View>
  </Page>
);

// ============================================================
// DOCUMENTO COMPLETO (por enquanto só 2 páginas de teste)
// ============================================================
const BetaSuitesBookPDF = () => (
  <Document title="Book de Investidor - Beta Suítes" author="Studio 57 Incorporações">
    <PaginaCapa />
    <PaginaFinanceira />
  </Document>
);

export default BetaSuitesBookPDF;
