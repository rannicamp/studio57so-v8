// components/painel/UserInfoCard.js

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhone, faEnvelope, faBriefcase } from '@fortawesome/free-solid-svg-icons';

const UserInfoCard = ({ user }) => {
  // Estado de Carregamento (mostra um "esqueleto" bonito)
  if (!user) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse h-full">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-gray-300 rounded-full"></div>
          <div>
            <div className="h-6 bg-gray-300 rounded w-40 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-60"></div>
          </div>
        </div>
        <div className="mt-6 space-y-3 border-t pt-4">
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-full"></div>
        </div>
      </div>
    );
  }

  // Card com os dados reais do usuário
  return (
    <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
      <div className="flex items-center space-x-4">
        <img
          src={user.avatar_url || 'https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg'}
          alt="Foto do Usuário"
          className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
        />
        <div>
          <h2 className="text-xl font-bold text-gray-800">{user.full_name || 'Nome do Usuário'}</h2>
          <p className="text-gray-500">{user.role || 'Cargo não definido'}</p>
        </div>
      </div>
      <div className="mt-6 space-y-3 border-t pt-4 flex-grow">
        <div className="flex items-center text-gray-600">
          <FontAwesomeIcon icon={faBriefcase} className="w-4 h-4 mr-3 text-gray-400" />
          <span>{user.cargo || 'Cargo não informado'}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4 mr-3 text-gray-400" />
          <span>{user.email || 'E-mail não informado'}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <FontAwesomeIcon icon={faPhone} className="w-4 h-4 mr-3 text-gray-400" />
          <span>{user.telefone || 'Telefone não informado'}</span>
        </div>
      </div>
    </div>
  );
};

export default UserInfoCard;