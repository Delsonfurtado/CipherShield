import type { UserProfile } from '@/types/auth';

const DATABASE_NAME = 'ciphershield-local-accounts';
const DATABASE_VERSION = 1;
const ACCOUNT_STORE = 'accounts';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ACCOUNT_STORE)) {
        request.result.createObjectStore(ACCOUNT_STORE, { keyPath: 'email' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local account storage'));
  });
}

export async function saveLocalAccount(profile: UserProfile): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ACCOUNT_STORE, 'readwrite');
      transaction.objectStore(ACCOUNT_STORE).put(profile);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local account'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local account save was interrupted'));
    });
  } finally {
    db.close();
  }
}

export async function getLocalAccount(email: string): Promise<UserProfile | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(ACCOUNT_STORE, 'readonly');
      const request = transaction.objectStore(ACCOUNT_STORE).get(email.trim().toLowerCase());
      request.onsuccess = () => resolve((request.result as UserProfile | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not read local account'));
    });
  } finally {
    db.close();
  }
}
