import type { VaultItem } from '@/types/vault';

const DATABASE_NAME = 'ciphershield-local-vault';
const DATABASE_VERSION = 1;
const ITEM_STORE = 'encrypted-items';

type VaultRecordWithPlaintext = VaultItem & {
  decryptedData?: unknown;
  data?: unknown;
  isWeak?: boolean;
  isReused?: boolean;
  isOld?: boolean;
  isBreached?: boolean;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        db.createObjectStore(ITEM_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local vault storage'));
  });
}

export async function getLocalVaultItems(userId: string): Promise<VaultItem[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(ITEM_STORE, 'readonly');
      const request = transaction.objectStore(ITEM_STORE).getAll();
      request.onsuccess = () =>
        resolve((request.result as VaultItem[]).filter((item) => item.user_id === userId));
      request.onerror = () => reject(request.error ?? new Error('Could not read local vault data'));
    });
  } finally {
    db.close();
  }
}

export async function putLocalVaultItems(items: VaultItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ITEM_STORE, 'readwrite');
      const store = transaction.objectStore(ITEM_STORE);
      for (const item of items) {
        // Never persist decrypted vault content or UI-derived security flags.
        const encryptedRecord = { ...item } as VaultRecordWithPlaintext;
        delete encryptedRecord.decryptedData;
        delete encryptedRecord.data;
        delete encryptedRecord.isWeak;
        delete encryptedRecord.isReused;
        delete encryptedRecord.isOld;
        delete encryptedRecord.isBreached;
        store.put(encryptedRecord);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local vault data'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local vault save was interrupted'));
    });
  } finally {
    db.close();
  }
}

export async function putLocalVaultItem(item: VaultItem): Promise<void> {
  await putLocalVaultItems([item]);
}

export async function deleteLocalVaultItem(userId: string, itemId: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ITEM_STORE, 'readwrite');
      const store = transaction.objectStore(ITEM_STORE);
      const request = store.get(itemId);
      request.onsuccess = () => {
        const item = request.result as VaultItem | undefined;
        if (item?.user_id === userId) store.delete(itemId);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not delete local vault data'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local vault delete was interrupted'));
    });
  } finally {
    db.close();
  }
}
