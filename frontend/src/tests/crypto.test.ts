/**
 * CipherShield — Frontend Cryptography Tests (Vitest)
 */
import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '@/lib/crypto/aes-gcm';
import { deriveKeys } from '@/lib/crypto/hkdf';
import {
  generateVaultKey,
  encryptVaultKey,
  decryptVaultKey,
  encryptVaultItem,
  decryptVaultItem,
} from '@/lib/crypto/vault-crypto';
import {
  generateRecoveryPhrase,
  deriveRecoveryKey,
  encryptVaultKeyWithRecovery,
  recoverVaultKey,
} from '@/lib/crypto/recovery';

describe('Web Crypto AES-256-GCM', () => {
  it('encrypts and decrypts arbitrary byte arrays correctly', async () => {
    const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
    const key = await window.crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const enc = new TextEncoder();
    const data = enc.encode('Hello CipherShield Zero-Knowledge Vault');

    const { ciphertext, iv } = await encrypt(key, data);
    expect(ciphertext).toBeDefined();
    expect(iv.length).toBe(12);

    const decrypted = await decrypt(key, ciphertext, iv);
    const dec = new TextDecoder();
    expect(dec.decode(decrypted)).toBe('Hello CipherShield Zero-Knowledge Vault');
  });

  it('converts between Uint8Array and Base64 accurately', () => {
    const original = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const b64 = uint8ArrayToBase64(original);
    const roundtrip = base64ToUint8Array(b64);
    expect(roundtrip).toEqual(original);
  });
});

describe('HKDF Key Splitting', () => {
  it('splits master key bytes into auth key and AES-GCM encryption key', async () => {
    const masterKey = window.crypto.getRandomValues(new Uint8Array(64));
    const { authKey, encryptionKey } = await deriveKeys(masterKey);

    expect(authKey.length).toBe(32);
    expect(encryptionKey.algorithm.name).toBe('AES-GCM');
  });
});

describe('Vault Key Lifecycle & Recovery', () => {
  it('generates, encrypts, and decrypts a random 256-bit vault key', async () => {
    const masterKey = window.crypto.getRandomValues(new Uint8Array(64));
    const { encryptionKey } = await deriveKeys(masterKey);

    const vaultKey = await generateVaultKey();
    const { encrypted_vault_key, iv } = await encryptVaultKey(encryptionKey, vaultKey);

    expect(encrypted_vault_key).toBeDefined();
    expect(iv).toBeDefined();

    const unwrappedVaultKey = await decryptVaultKey(encryptionKey, encrypted_vault_key, iv);
    expect(unwrappedVaultKey).toBeDefined();

    // Verify unwrapped key can encrypt and decrypt items
    const testItem = { title: 'Bank of America', username: 'alex', password: 'SecretPassword123!' };
    const { encrypted_data } = await encryptVaultItem(unwrappedVaultKey, testItem);
    const decryptedItem = await decryptVaultItem(unwrappedVaultKey, encrypted_data);

    expect(decryptedItem).toEqual(testItem);
  });

  it('recovers vault key using 24-word recovery phrase', async () => {
    const phrase = generateRecoveryPhrase();
    const words = phrase.split(' ');
    expect(words.length).toBe(24);

    const recoveryKey = await deriveRecoveryKey(phrase);
    const vaultKey = await generateVaultKey();

    const { encryptedRecoveryKey, iv } = await encryptVaultKeyWithRecovery(recoveryKey, vaultKey);
    const recoveredVaultKey = await recoverVaultKey(recoveryKey, encryptedRecoveryKey, iv);

    const testSecret = { note: 'Top secret offshore account' };
    const { encrypted_data } = await encryptVaultItem(vaultKey, testSecret);
    const decryptedSecret = await decryptVaultItem(recoveredVaultKey, encrypted_data);

    expect(decryptedSecret).toEqual(testSecret);
  });
});
