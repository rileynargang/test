import * as SQLite from 'expo-sqlite';
import { Receipt, ReceiptFilters, Category, SyncStatus } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('receipts.db');
    await initDB(db);
  }
  return db;
}

async function initDB(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS receipts (
      id                    TEXT PRIMARY KEY,
      image_uri             TEXT NOT NULL,
      thumbnail_uri         TEXT NOT NULL DEFAULT '',
      merchant              TEXT NOT NULL DEFAULT '',
      amount                INTEGER NOT NULL DEFAULT 0,
      currency              TEXT NOT NULL DEFAULT 'USD',
      date                  TEXT NOT NULL,
      category              TEXT NOT NULL DEFAULT 'other',
      notes                 TEXT NOT NULL DEFAULT '',
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL,
      sync_status           TEXT NOT NULL DEFAULT 'not_configured',
      google_drive_file_id  TEXT,
      google_drive_meta_file_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_date     ON receipts(date DESC);
    CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
  `);
}

function rowToReceipt(row: Record<string, unknown>): Receipt {
  return {
    id: row.id as string,
    imageUri: row.image_uri as string,
    thumbnailUri: row.thumbnail_uri as string,
    merchant: row.merchant as string,
    amount: row.amount as number,
    currency: row.currency as string,
    date: row.date as string,
    category: row.category as Category,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncStatus: row.sync_status as SyncStatus,
    googleDriveFileId: row.google_drive_file_id as string | undefined,
    googleDriveMetaFileId: row.google_drive_meta_file_id as string | undefined,
  };
}

export async function getReceipts(filters?: ReceiptFilters): Promise<Receipt[]> {
  const database = await getDB();
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (filters?.category) {
    conditions.push('category = ?');
    args.push(filters.category);
  }
  if (filters?.startDate) {
    conditions.push('date >= ?');
    args.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push('date <= ?');
    args.push(filters.endDate);
  }
  if (filters?.searchQuery) {
    conditions.push('merchant LIKE ?');
    args.push(`%${filters.searchQuery}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM receipts ${where} ORDER BY date DESC, created_at DESC`,
    args
  );
  return rows.map(rowToReceipt);
}

export async function getReceiptById(id: string): Promise<Receipt | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM receipts WHERE id = ?',
    [id]
  );
  return row ? rowToReceipt(row) : null;
}

export async function addReceipt(receipt: Receipt): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO receipts
      (id, image_uri, thumbnail_uri, merchant, amount, currency, date, category,
       notes, created_at, updated_at, sync_status, google_drive_file_id, google_drive_meta_file_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receipt.id,
      receipt.imageUri,
      receipt.thumbnailUri,
      receipt.merchant,
      receipt.amount,
      receipt.currency,
      receipt.date,
      receipt.category,
      receipt.notes,
      receipt.createdAt,
      receipt.updatedAt,
      receipt.syncStatus,
      receipt.googleDriveFileId ?? null,
      receipt.googleDriveMetaFileId ?? null,
    ]
  );
}

export async function updateReceipt(id: string, updates: Partial<Receipt>): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const args: (string | number | null)[] = [now];

  if (updates.merchant !== undefined) { fields.push('merchant = ?'); args.push(updates.merchant); }
  if (updates.amount !== undefined) { fields.push('amount = ?'); args.push(updates.amount); }
  if (updates.currency !== undefined) { fields.push('currency = ?'); args.push(updates.currency); }
  if (updates.date !== undefined) { fields.push('date = ?'); args.push(updates.date); }
  if (updates.category !== undefined) { fields.push('category = ?'); args.push(updates.category); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); args.push(updates.notes); }
  if (updates.syncStatus !== undefined) { fields.push('sync_status = ?'); args.push(updates.syncStatus); }
  if (updates.googleDriveFileId !== undefined) { fields.push('google_drive_file_id = ?'); args.push(updates.googleDriveFileId ?? null); }
  if (updates.googleDriveMetaFileId !== undefined) { fields.push('google_drive_meta_file_id = ?'); args.push(updates.googleDriveMetaFileId ?? null); }

  args.push(id);
  await database.runAsync(`UPDATE receipts SET ${fields.join(', ')} WHERE id = ?`, args);
}

export async function deleteReceipt(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
}

export async function getPendingSync(): Promise<Receipt[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM receipts WHERE sync_status = 'pending'"
  );
  return rows.map(rowToReceipt);
}
