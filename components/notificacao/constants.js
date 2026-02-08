import { 
  faBell, faMoneyBillWave, faUserPlus, faCheckCircle, 
  faExclamationTriangle, faBirthdayCake, faFileContract, faBriefcase, 
  faBullhorn, faBolt, faDatabase
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp as faWhatsappBrand } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const AVAILABLE_ICONS = [
  { icon: faBell, name: 'fa-bell', label: 'Padrão' },
  { icon: faWhatsappBrand, name: 'fa-whatsapp', label: 'WhatsApp' },
  { icon: faMoneyBillWave, name: 'fa-money-bill-wave', label: 'Financeiro' },
  { icon: faUserPlus, name: 'fa-user-plus', label: 'Novo Lead' },
  { icon: faCheckCircle, name: 'fa-check-circle', label: 'Sucesso' },
  { icon: faExclamationTriangle, name: 'fa-exclamation-triangle', label: 'Alerta' },
  { icon: faBirthdayCake, name: 'fa-birthday-cake', label: 'Aniversário' },
  { icon: faFileContract, name: 'fa-file-contract', label: 'Contrato' },
  { icon: faBriefcase, name: 'fa-briefcase', label: 'Trabalho' },
  { icon: faBullhorn, name: 'fa-bullhorn', label: 'Aviso' },
  { icon: faBolt, name: 'fa-bolt', label: 'Ação' },
  { icon: faDatabase, name: 'fa-database', label: 'Sistema' },
];

export const renderIcon = (iconName, className = "") => {
  const found = AVAILABLE_ICONS.find(i => i.name === iconName);
  return <FontAwesomeIcon icon={found ? found.icon : faBell} className={className} />;
};