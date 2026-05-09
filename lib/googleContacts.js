import { google } from 'googleapis';
import { getOAuth2Client } from './googleCalendar';

/**
 * Retorna uma instância do serviço People API pronta para uso
 */
export const getPeopleService = (accessToken, refreshToken) => {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.people({ version: 'v1', auth: oauth2Client });
};

/**
 * Busca ou cria um Marcador (Contact Group) no Google Contacts
 */
export const getOrCreateContactGroup = async (peopleService, groupName) => {
  // 1. Busca os grupos existentes do usuário
  const response = await peopleService.contactGroups.list();
  const groups = response.data.contactGroups || [];

  const existingGroup = groups.find(g => g.name === groupName || g.formattedName === groupName);
  
  if (existingGroup) {
    return existingGroup.resourceName; // Ex: 'contactGroups/123456789'
  }

  // 2. Se não existir, cria o grupo
  const createdGroup = await peopleService.contactGroups.create({
    requestBody: {
      contactGroup: {
        name: groupName
      }
    }
  });

  return createdGroup.data.resourceName;
};

/**
 * Cria um novo contato na agenda do usuário via People API
 * 
 * @param {Object} params
 * @param {string} params.accessToken
 * @param {string} params.refreshToken
 * @param {Object} params.contatoData
 * @param {string} params.contatoData.nome - Nome do contato (ex: João da Silva)
 * @param {string} [params.contatoData.telefone] - Telefone principal
 * @param {string} [params.contatoData.email] - Email principal
 * @param {string} [params.contatoData.empresa] - Nome da empresa associada
 */
export const createContact = async ({
  accessToken,
  refreshToken,
  contatoData
}) => {
  const peopleService = getPeopleService(accessToken, refreshToken);
  
  const { nome, telefone, email, empresa } = contatoData;

  // Montamos o corpo da requisição segundo o padrão do Google People API
  const requestBody = {
    names: [
      {
        givenName: nome, // Sem sufixo, mantendo o nome limpo
      }
    ]
  };

  // Garante que o Marcador "Elo 57" e outras tags existam e pega os IDs deles
  const tagsToApply = ['Elo 57'];
  if (contatoData.tipo_contato) {
    // Ex: "Lead", "Fornecedor", etc.
    tagsToApply.push(contatoData.tipo_contato);
  }

  requestBody.memberships = [];

  for (const tag of tagsToApply) {
    try {
      const groupId = await getOrCreateContactGroup(peopleService, tag);
      if (groupId) {
        requestBody.memberships.push({
          contactGroupMembership: {
            contactGroupResourceName: groupId
          }
        });
      }
    } catch (err) {
      console.error(`Aviso: Não foi possível aplicar a Tag/Marcador "${tag}" ao contato:`, err);
    }
  }

  // Se não conseguiu nenhuma tag, remove o array vazio para não dar erro
  if (requestBody.memberships.length === 0) {
    delete requestBody.memberships;
  }

  if (telefone) {
    requestBody.phoneNumbers = [
      {
        value: telefone,
        type: 'mobile'
      }
    ];
  }

  if (email) {
    requestBody.emailAddresses = [
      {
        value: email,
        type: 'work'
      }
    ];
  }

  if (empresa) {
    requestBody.organizations = [
      {
        name: empresa,
        title: 'Lead/Cliente'
      }
    ];
  }

  try {
    const response = await peopleService.people.createContact({
      requestBody,
      personFields: 'names,emailAddresses,phoneNumbers,organizations',
    });

    return response.data;
  } catch (error) {
    console.error('Erro ao criar contato no Google:', error);
    throw error;
  }
};
