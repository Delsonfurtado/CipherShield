/**
 * CipherShield — Vault Cryptography Operations
 * Zero-knowledge item encryption, vault key wrapping, and unwrapping.
 */
import { encrypt, decrypt, uint8ArrayToBase64, base64ToUint8Array } from './aes-gcm';

export async function generateVaultKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable so it can be wrapped/exported
    ["encrypt", "decrypt"]
  );
}

export async function exportVaultKey(vaultKey: CryptoKey): Promise<Uint8Array> {
  const raw = await window.crypto.subtle.exportKey("raw", vaultKey);
  return new Uint8Array(raw);
}

export async function importVaultKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "raw",
    rawBytes,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVaultKey(
  encryptionKey: CryptoKey,
  vaultKey: CryptoKey
): Promise<{ encrypted_vault_key: string; iv: string }> {
  const rawVaultKey = await exportVaultKey(vaultKey);
  const { ciphertext, iv } = await encrypt(encryptionKey, rawVaultKey);
  return {
    encrypted_vault_key: uint8ArrayToBase64(ciphertext),
    iv: uint8ArrayToBase64(iv),
  };
}

export async function decryptVaultKey(
  encryptionKey: CryptoKey,
  encrypted_vault_key: string,
  iv: string
): Promise<CryptoKey> {
  const ciphertextBytes = base64ToUint8Array(encrypted_vault_key);
  const ivBytes = base64ToUint8Array(iv);
  const rawVaultKey = await decrypt(encryptionKey, ciphertextBytes, ivBytes);
  return await importVaultKey(rawVaultKey);
}

export async function encryptVaultItem(
  vaultKey: CryptoKey,
  itemData: Record<string, unknown>
): Promise<{ encrypted_data: string; iv: string }> {
  const enc = new TextEncoder();
  const jsonBytes = enc.encode(JSON.stringify(itemData));
  const { ciphertext, iv } = await encrypt(vaultKey, jsonBytes);
  const ivB64 = uint8ArrayToBase64(iv);
  const cipherB64 = uint8ArrayToBase64(ciphertext);
  return {
    // Encrypted data format: IV.CIPHERTEXT
    encrypted_data: `${ivB64}.${cipherB64}`,
    iv: ivB64,
  };
}

export async function decryptVaultItem<T = Record<string, unknown>>(
  vaultKey: CryptoKey,
  encrypted_data: string,
  iv?: string
): Promise<T> {
  let ivB64 = iv;
  let cipherB64 = encrypted_data;

  if (encrypted_data.includes('.')) {
    const parts = encrypted_data.split('.');
    ivB64 = parts[0];
    cipherB64 = parts[1];
  }

  if (!ivB64) {
    throw new Error("Missing IV for vault item decryption");
  }

  const ivBytes = base64ToUint8Array(ivB64);
  const cipherBytes = base64ToUint8Array(cipherB64);
  const decryptedBytes = await decrypt(vaultKey, cipherBytes, ivBytes);
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBytes)) as T;
}
