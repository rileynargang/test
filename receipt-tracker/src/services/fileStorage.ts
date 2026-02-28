import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const IMAGES_DIR = `${FileSystem.documentDirectory}images/`;
const THUMBS_DIR = `${FileSystem.documentDirectory}thumbnails/`;

async function ensureDirs(): Promise<void> {
  for (const dir of [IMAGES_DIR, THUMBS_DIR]) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

export async function saveReceiptImage(
  sourceUri: string,
  receiptId: string
): Promise<{ imageUri: string; thumbnailUri: string }> {
  await ensureDirs();

  const imageUri = `${IMAGES_DIR}${receiptId}.jpg`;
  const thumbnailUri = `${THUMBS_DIR}${receiptId}.jpg`;

  // Copy full-size image
  await FileSystem.copyAsync({ from: sourceUri, to: imageUri });

  // Generate compressed thumbnail (400×400 max)
  const thumb = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 400 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );
  await FileSystem.copyAsync({ from: thumb.uri, to: thumbnailUri });

  return { imageUri, thumbnailUri };
}

export async function deleteReceiptImages(receiptId: string): Promise<void> {
  const imageUri = `${IMAGES_DIR}${receiptId}.jpg`;
  const thumbnailUri = `${THUMBS_DIR}${receiptId}.jpg`;

  for (const uri of [imageUri, thumbnailUri]) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  }
}

export async function copyToCacheForSharing(
  sourceUri: string,
  filename: string
): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function writeCsvToCache(csv: string, filename: string): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return dest;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30);
}

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// Saves receipt image to documentDirectory/Receipts/{Merchant}_{Date}.jpg
// Visible in iOS Files → On My iPhone → Receipt Tracker → Receipts
export async function saveReceiptToFilesApp(receipt: {
  imageUri: string;
  merchant: string;
  date: string;
}): Promise<string> {
  const dir = `${FileSystem.documentDirectory}Receipts/`;
  await ensureDir(dir);
  const name = `${sanitizeFilename(receipt.merchant || 'Receipt')}_${receipt.date}.jpg`;
  const dest = `${dir}${name}`;
  await FileSystem.copyAsync({ from: receipt.imageUri, to: dest });
  return dest;
}

// Saves CSV to documentDirectory/Exports/receipts_{date}.csv
// Visible in iOS Files → On My iPhone → Receipt Tracker → Exports
export async function saveCsvToFilesApp(csv: string, date: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}Exports/`;
  await ensureDir(dir);
  const dest = `${dir}receipts_${date}.csv`;
  await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return dest;
}
