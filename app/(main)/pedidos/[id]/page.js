//app\(main)\pedidos\[id]\page.js
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLayout } from '../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import PedidoForm from '../../../../components/pedidos/PedidoForm'; // Importando o formulário real

export default function EdicaoPedidoPage() {
 const { id } = useParams();
 const router = useRouter();
 const { setPageTitle } = useLayout();

 useEffect(() => {
 setPageTitle(`Editando Pedido de Compra #${id}`);
 }, [id, setPageTitle]);

 return (
 <div className="space-y-4">

 {/* Usando o componente de formulário real e passando o ID do pedido */}
 <PedidoForm pedidoId={id} />
 </div>
 );
}