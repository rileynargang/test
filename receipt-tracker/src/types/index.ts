export type Category =
  | 'food'
  | 'travel'
  | 'office'
  | 'entertainment'
  | 'medical'
  | 'other';

export type SyncStatus = 'not_configured' | 'pending' | 'synced' | 'failed';

export interface Receipt {
  id: string;
  imageUri: string;       // local path in documentDirectory
  thumbnailUri: string;   // compressed thumbnail path
  merchant: string;
  /** Amount stored in cents (e.g. $12.99 → 1299) */
  amount: number;
  currency: string;       // ISO 4217, default 'USD'
  date: string;           // YYYY-MM-DD
  category: Category;
  notes: string;
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  syncStatus: SyncStatus;
  googleDriveFileId?: string;
  googleDriveMetaFileId?: string;
}

export interface ReceiptFilters {
  category?: Category;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  searchQuery?: string;
}

export const CATEGORIES: { id: Category; label: string; color: string; icon: string }[] = [
  { id: 'food',          label: 'Food & Dining',    color: '#FF6B6B', icon: 'restaurant' },
  { id: 'travel',        label: 'Travel',           color: '#4ECDC4', icon: 'airplane' },
  { id: 'office',        label: 'Office',           color: '#45B7D1', icon: 'briefcase' },
  { id: 'entertainment', label: 'Entertainment',    color: '#DDA0DD', icon: 'musical-notes' },
  { id: 'medical',       label: 'Medical',          color: '#96CEB4', icon: 'medkit' },
  { id: 'other',         label: 'Other',            color: '#B0BEC5', icon: 'ellipsis-horizontal' },
];

export function formatAmount(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
