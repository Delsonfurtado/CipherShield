/**
 * CipherShield — Client-side Argon2id Key Derivation
 * Uses argon2-browser (WebAssembly) with graceful Web Crypto PBKDF2 fallback for non-WASM runtimes.
 */
import type {
  Argon2BrowserHashOptions,
  Argon2BrowserHashResult,
} from 'argon2-browser';
import type { KDFParams } from '@/types/auth';

type Argon2Browser = {
  hash: (options: Argon2BrowserHashOptions) => Promise<Argon2BrowserHashResult>;
  ArgonType: typeof import('argon2-browser').ArgonType;
};

export async function deriveMasterKey(
  masterPassword: string,
  salt: Uint8Array,
  params: KDFParams = { m: 65536, t: 3, p: 1 }
): Promise<Uint8Array> {
  try {
    // Attempt Argon2id WASM hash derivation
    const argon2 = (window as Window & { argon2?: Argon2Browser }).argon2;
    if (!argon2) throw new Error('Argon2 browser bundle did not load');
    const result = await argon2.hash({
      pass: masterPassword,
      salt,
      type: argon2.ArgonType.Argon2id,
      mem: params.m,
      time: params.t,
      parallelism: params.p,
      hashLen: 64, // 32 bytes for authKey + 32 bytes for encryptionKey
    });
    return result.hash;
  } catch (error) {
    console.warn("Argon2 WASM unavailable, falling back to Web Crypto PBKDF2 derivation:", error);
    // Fallback: Web Crypto PBKDF2-HMAC-SHA256 (600,000 iterations, 64 bytes output)
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(masterPassword),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 600000,
        hash: "SHA-256",
      },
      keyMaterial,
      512 // 64 bytes
    );
    return new Uint8Array(derivedBits);
  }
}
