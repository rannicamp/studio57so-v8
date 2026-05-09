import { google } from 'googleapis';
import { getOAuth2Client } from './googleCalendar';

/**
 * Retorna uma instância do serviço Drive pronta para uso
 */
export const getDriveService = (accessToken, refreshToken) => {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.drive({ version: 'v3', auth: oauth2Client });
};

/**
 * Cria uma pasta no Google Drive (ou retorna a ID se já existir)
 */
export const getOrCreateFolder = async (driveService, folderName, parentId = null) => {
  // 1. Verifica se a pasta já existe
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await driveService.files.list({
    q: query,
    spaces: 'drive',
    fields: 'files(id, name)',
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // 2. Se não existe, cria a pasta
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined
  };

  const folder = await driveService.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });

  return folder.data.id;
};

/**
 * Faz upload de um arquivo para o Google Drive
 */
export const uploadFileToDrive = async ({
  accessToken,
  refreshToken,
  fileName,
  mimeType,
  fileStreamOrBuffer,
  folderId = null
}) => {
  const drive = getDriveService(accessToken, refreshToken);
  
  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : undefined
  };

  const media = {
    mimeType: mimeType,
    body: fileStreamOrBuffer // Pode ser um stream.Readable ou Buffer (se convertido pra stream)
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });

  return file.data;
};
