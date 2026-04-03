import AdsManager from '@/components/comercial/AdsManager';

export const metadata = {
 title: 'Gestão de Anúncios | Elo 57',
 description: 'Gerenciamento de campanhas e leads do Meta Ads',
};

export default function AnunciosPage() {
 return (
 <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
 <AdsManager />
 </div>
 );
}