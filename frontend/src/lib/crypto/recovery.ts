/**
 * CipherShield — 24-Word Recovery Phrase and Master Vault Recovery Key
 * Allows deterministic offline recovery of the Vault Key if master password is forgotten.
 */
import { encrypt, decrypt, uint8ArrayToBase64, base64ToUint8Array } from './aes-gcm';
import { exportVaultKey, importVaultKey } from './vault-crypto';

const BIP39_WORDLIST = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
  "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
  "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
  "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album",
  "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone",
  "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among",
  "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry",
  "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
  "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april",
  "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor",
  "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact",
  "artist", "artwork", "ask", "aspect", "assault", "asset", "assist", "assume",
  "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
  "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado",
  "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis",
  "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball",
  "bamboo", "banana", "banner", "bar", "barely", "bargain", "barrel", "base",
  "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
  "beef", "before", "begin", "behave", "behind", "believe", "below", "belt",
  "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle",
  "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black",
  "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood",
  "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
  "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring",
  "borrow", "boss", "bottom", "bounce", "box", "boy", "bracket", "brain",
  "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief",
  "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom", "brother"
];

export function generateRecoveryPhrase(): string {
  const words: string[] = [];
  const randomIndices = new Uint32Array(24);
  window.crypto.getRandomValues(randomIndices);
  for (let i = 0; i < 24; i++) {
    const idx = randomIndices[i] % BIP39_WORDLIST.length;
    words.push(BIP39_WORDLIST[idx]);
  }
  return words.join(" ");
}

export async function deriveRecoveryKey(recoveryPhrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const normalized = recoveryPhrase.trim().toLowerCase();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(normalized),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("ciphershield-recovery-salt-v1"),
      iterations: 300000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVaultKeyWithRecovery(
  recoveryKey: CryptoKey,
  vaultKey: CryptoKey
): Promise<{ encryptedRecoveryKey: string; iv: string }> {
  const rawVaultKey = await exportVaultKey(vaultKey);
  const { ciphertext, iv } = await encrypt(recoveryKey, rawVaultKey);
  return {
    encryptedRecoveryKey: uint8ArrayToBase64(ciphertext),
    iv: uint8ArrayToBase64(iv),
  };
}

export async function recoverVaultKey(
  recoveryKey: CryptoKey,
  encryptedRecoveryKey: string,
  iv: string
): Promise<CryptoKey> {
  const ciphertextBytes = base64ToUint8Array(encryptedRecoveryKey);
  const ivBytes = base64ToUint8Array(iv);
  const rawBytes = await decrypt(recoveryKey, ciphertextBytes, ivBytes);
  return await importVaultKey(rawBytes);
}
