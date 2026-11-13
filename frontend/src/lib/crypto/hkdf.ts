/**
 * CipherShield — HKDF Key Splitting
 * Derives an Auth Key (for authentication) and an Encryption Key (never leaves device).
 */

export async function deriveKeys(masterKeyBytes: Uint8Array): Promise<{
  authKey: Uint8Array;
  encryptionKey: CryptoKey;
}> {
  const enc = new TextEncoder();

  // Import master key material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    masterKeyBytes,
    { name: "HKDF" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // 1. Derive Auth Key (32 bytes)
  const authKeyBits = await window.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("ciphershield-salt-v1"),
      info: enc.encode("ciphershield-auth-key"),
    },
    baseKey,
    256 // 32 bytes
  );
  const authKey = new Uint8Array(authKeyBits);

  // 2. Derive Encryption Key (AES-GCM, 256 bits)
  const encryptionKey = await window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("ciphershield-salt-v1"),
      info: enc.encode("ciphershield-encryption-key"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );

  return { authKey, encryptionKey };
}
