import * as FileSystem from 'expo-file-system/legacy';
import { getValidAccessToken } from './auth';
import { Receipt } from '../types';
import { updateReceipt } from './database';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME = 'Receipt Tracker';

let cachedFolderId: string | null = null;

async function authHeaders(): Promise<HeadersInit> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not signed in to Google Drive');
  return { Authorization: `Bearer ${token}` };
}

async function getOrCreateFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const headers = await authHeaders();

  // Search for existing folder
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(
    `${DRIVE_FILES_URL}?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers }
  );
  if (!searchRes.ok) throw new Error('Failed to search Drive folders');

  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) {
    cachedFolderId = searchData.files[0].id;
    return cachedFolderId!;
  }

  // Create folder
  const createRes = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) throw new Error('Failed to create Drive folder');

  const folder = await createRes.json();
  cachedFolderId = folder.id;
  return cachedFolderId!;
}

async function uploadMultipart(
  filename: string,
  mimeType: string,
  fileUri: string,
  parentId: string
): Promise<string> {
  const headers = await authHeaders();

  const metadata = JSON.stringify({ name: filename, parents: [parentId] });
  const boundary = 'receipt_tracker_boundary';

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Build multipart body
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload failed: ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}

async function uploadJson(
  filename: string,
  content: string,
  parentId: string
): Promise<string> {
  const headers = await authHeaders();
  const boundary = 'receipt_tracker_json_boundary';
  const metadata = JSON.stringify({ name: filename, parents: [parentId] });
  const b64 = Buffer.from(content).toString('base64');

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${b64}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive JSON upload failed: ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}

export async function uploadReceiptToDrive(receipt: Receipt): Promise<void> {
  const folderId = await getOrCreateFolder();

  // Upload image
  const imageFileId = await uploadMultipart(
    `${receipt.id}.jpg`,
    'image/jpeg',
    receipt.imageUri,
    folderId
  );

  // Upload metadata JSON sidecar
  const metaContent = JSON.stringify(receipt, null, 2);
  const metaFileId = await uploadJson(`${receipt.id}.json`, metaContent, folderId);

  // Update local DB with Drive file IDs and mark synced
  await updateReceipt(receipt.id, {
    syncStatus: 'synced',
    googleDriveFileId: imageFileId,
    googleDriveMetaFileId: metaFileId,
  });
}

export async function deleteFromDrive(receipt: Receipt): Promise<void> {
  if (!receipt.googleDriveFileId && !receipt.googleDriveMetaFileId) return;
  const headers = await authHeaders();

  for (const fileId of [receipt.googleDriveFileId, receipt.googleDriveMetaFileId]) {
    if (!fileId) continue;
    await fetch(`${DRIVE_FILES_URL}/${fileId}`, { method: 'DELETE', headers });
  }
}

export async function syncPendingReceipts(pendingReceipts: Receipt[]): Promise<{
  success: number;
  failed: number;
}> {
  let success = 0;
  let failed = 0;

  for (const receipt of pendingReceipts) {
    try {
      await uploadReceiptToDrive(receipt);
      success++;
    } catch {
      await updateReceipt(receipt.id, { syncStatus: 'failed' });
      failed++;
    }
  }

  return { success, failed };
}
