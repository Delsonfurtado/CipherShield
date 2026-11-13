/**
 * CipherShield — Zero-Knowledge Authentication Store
 * The Vault Key and Encryption Key reside STRICTLY in volatile RAM and are NEVER written to disk/localStorage.
 */
import { create } from 'zustand';
import { authApi } from '@/lib/api/auth';
import { setApiAuthToken } from '@/lib/api/client';
import { getLocalAccount, saveLocalAccount } from '@/lib/storage/localAccounts';

// Only production builds use the cloud API. Development remains on this laptop.
const useRemoteAuth = import.meta.env.VITE_USE_REMOTE_API === 'true' || !import.meta.env.DEV;
import {
  deriveMasterKey,
  deriveKeys,
  generateVaultKey,
  encryptVaultKey,
  decryptVaultKey,
  generateRecoveryPhrase,
  deriveRecoveryKey,
  encryptVaultKeyWithRecovery,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '@/lib/crypto';
import type { UserProfile } from '@/types/auth';

async function unlockLocalAccount(email: string, masterPassword: string) {
  const profile = await getLocalAccount(email);
  if (!profile) throw new Error('No local account exists for this email on this device.');

  try {
    const saltBytes = base64ToUint8Array(profile.argon2_salt);
    const masterKeyBytes = await deriveMasterKey(
      masterPassword,
      saltBytes,
      profile.kdf_params || { m: 65536, t: 3, p: 1 },
    );
    const { encryptionKey } = await deriveKeys(masterKeyBytes);
    const vaultKey = await decryptVaultKey(
      encryptionKey,
      profile.encrypted_vault_key,
      profile.vault_key_iv || profile.kdf_params?.vault_key_iv || '',
    );
    return { profile, encryptionKey, vaultKey };
  } catch {
    throw new Error('That master password does not match this local vault.');
  }
}

function waitForServer<T>(request: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Authentication service timed out')), 6000);
    request.then(
      (value) => { window.clearTimeout(timeout); resolve(value); },
      (error) => { window.clearTimeout(timeout); reject(error); },
    );
  });
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  vaultKey: CryptoKey | null;
  encryptionKey: CryptoKey | null;
  isVaultLocked: boolean;
  isLoading: boolean;
  authStage: string;
  loginEmail: string | null;

  login: (email: string, masterPassword: string, totpCode?: string) => Promise<{ requires2FA?: boolean }>;
  register: (email: string, masterPassword: string, displayName?: string) => Promise<{ recoveryPhrase: string }>;
  unlockVault: (masterPassword: string) => Promise<void>;
  lockVault: () => void;
  logout: () => void;
  setUser: (user: UserProfile | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('ciphershield_token'),
  vaultKey: null,
  encryptionKey: null,
  isVaultLocked: true,
  isLoading: false,
  authStage: 'idle',
  loginEmail: null,

  login: async (email: string, masterPassword: string, totpCode?: string) => {
    set({ isLoading: true, authStage: 'deriving_keys' });
    try {
      const cleanEmail = email.trim().toLowerCase();
      const localProfile = await getLocalAccount(cleanEmail);
      if (localProfile) {
        const local = await unlockLocalAccount(cleanEmail, masterPassword);
        const token = `local:${local.profile.user_id}`;
        setApiAuthToken(null);
        localStorage.setItem('ciphershield_token', token);
        set({ user: local.profile, token, vaultKey: local.vaultKey,
          encryptionKey: local.encryptionKey, isVaultLocked: false,
          isLoading: false, authStage: 'ready', loginEmail: null });
        return { requires2FA: false };
      }
      if (!useRemoteAuth) {
        throw new Error('No local vault exists for this email on this browser. Create a local vault first.');
      }
      try {
        const challenge = await waitForServer(authApi.getSalt(cleanEmail));
        const saltBytes = base64ToUint8Array(challenge.argon2_salt);
        const masterKeyBytes = await deriveMasterKey(
          masterPassword,
          saltBytes,
          challenge.kdf_params || { m: 65536, t: 3, p: 1 },
        );
        const { authKey, encryptionKey } = await deriveKeys(masterKeyBytes);
        const authKeyB64 = uint8ArrayToBase64(authKey);

        set({ authStage: 'authenticating' });
        const loginRes = await waitForServer(authApi.login({
          email: cleanEmail,
          password: authKeyB64,
          totp_code: totpCode,
        }));

        if (loginRes.requires_2fa) {
          set({ isLoading: false, authStage: '2fa_required', loginEmail: cleanEmail });
          return { requires2FA: true };
        }
        if (!loginRes.session || !loginRes.user) throw new Error('Login failed to provide user session');

        const token = loginRes.session.access_token;
        setApiAuthToken(token);
        localStorage.setItem('ciphershield_token', token);
        set({ authStage: 'decrypting_vault' });

        const profile = { ...loginRes.user, auth_mode: 'server' as const };
        const vaultKey = await decryptVaultKey(
          encryptionKey,
          profile.encrypted_vault_key,
          profile.vault_key_iv || profile.kdf_params?.vault_key_iv || '',
        );

        set({ user: profile, token, vaultKey, encryptionKey, isVaultLocked: false,
          isLoading: false, authStage: 'ready', loginEmail: null });
        return { requires2FA: false };
      } catch (remoteError) {
        if (!await getLocalAccount(cleanEmail)) {
          const message = remoteError instanceof Error ? remoteError.message : '';
          if (/failed to fetch|timed out|networkerror/i.test(message)) {
            throw new Error('No local vault exists for this email yet. Create a vault on this device first.');
          }
          throw remoteError;
        }
        const local = await unlockLocalAccount(cleanEmail, masterPassword);
        const token = `local:${local.profile.user_id}`;
        setApiAuthToken(null);
        localStorage.setItem('ciphershield_token', token);
        set({ user: local.profile, token, vaultKey: local.vaultKey,
          encryptionKey: local.encryptionKey, isVaultLocked: false,
          isLoading: false, authStage: 'ready', loginEmail: null });
        return { requires2FA: false };
      }
    } catch (error) {
      set({ isLoading: false, authStage: 'error' });
      throw error;
    }
  },

  register: async (email: string, masterPassword: string, displayName?: string) => {
    set({ isLoading: true, authStage: 'generating_keys' });
    try {
      const cleanEmail = email.trim().toLowerCase();

      if (await getLocalAccount(cleanEmail)) {
        throw new Error('A local vault already exists for this email. Sign in instead.');
      }

      // 1. Generate per-user random salt (16 bytes)
      const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = uint8ArrayToBase64(saltBytes);

      // 2. Generate 24-word recovery phrase
      const recoveryPhrase = generateRecoveryPhrase();
      const recoveryKey = await deriveRecoveryKey(recoveryPhrase);

      // 3. Derive 64-byte master key
      const kdfParams = { m: 65536, t: 3, p: 1 };
      const masterKeyBytes = await deriveMasterKey(masterPassword, saltBytes, kdfParams);

      // 4. Derive Auth Key and Encryption Key
      const { authKey, encryptionKey } = await deriveKeys(masterKeyBytes);
      const authKeyB64 = uint8ArrayToBase64(authKey);

      // 5. Generate random 256-bit Vault Key
      const vaultKey = await generateVaultKey();

      // 6. Encrypt Vault Key with Encryption Key
      const { encrypted_vault_key, iv } = await encryptVaultKey(encryptionKey, vaultKey);

      // 7. Also encrypt Vault Key with Recovery Key for offline recovery
      const { encryptedRecoveryKey, iv: recoveryIv } = await encryptVaultKeyWithRecovery(recoveryKey, vaultKey);

      // Save an encrypted local account so this device can unlock the vault
      // even when the optional authentication service is unavailable.
      const localId = window.crypto.randomUUID();
      const now = new Date().toISOString();
      const localKdfParams = {
        ...kdfParams,
        vault_key_iv: iv,
        encrypted_recovery_key: encryptedRecoveryKey,
        recovery_iv: recoveryIv,
      };
      const localProfile: UserProfile = {
        id: localId,
        user_id: localId,
        email: cleanEmail,
        auth_mode: 'local',
        encrypted_vault_key,
        vault_key_iv: iv,
        argon2_salt: saltB64,
        kdf_params: localKdfParams,
        recovery_key_hash: null,
        encrypted_recovery_vault_key: encryptedRecoveryKey,
        recovery_vault_key_iv: recoveryIv,
        two_factor_enabled: false,
        two_factor_secret: null,
        inactivity_timeout_minutes: 5,
        clipboard_clear_seconds: 30,
        created_at: now,
        updated_at: now,
      };
      await saveLocalAccount(localProfile);

      // Local development stores accounts and encrypted vault data in this browser.
      if (useRemoteAuth) try {
        const registered = await waitForServer(authApi.register({
          email: cleanEmail,
          password: authKeyB64,
          argon2_salt: saltB64,
          encrypted_vault_key,
          kdf_params: localKdfParams,
          display_name: displayName,
        }));
        await saveLocalAccount({ ...localProfile, id: registered.user_id,
          user_id: registered.user_id, auth_mode: 'local' });
      } catch (registrationError) {
        console.warn('Server registration unavailable; account is stored on this device.', registrationError);
      }

      set({ isLoading: false, authStage: 'idle' });
      return { recoveryPhrase };
    } catch (error) {
      set({ isLoading: false, authStage: 'error' });
      throw error;
    }
  },

  unlockVault: async (masterPassword: string) => {
    const { user } = get();
    if (!user) throw new Error("No user session active to unlock");

    set({ isLoading: true, authStage: 'deriving_keys' });
    try {
      const saltBytes = base64ToUint8Array(user.argon2_salt);
      const masterKeyBytes = await deriveMasterKey(
        masterPassword,
        saltBytes,
        user.kdf_params || { m: 65536, t: 3, p: 1 }
      );
      const { encryptionKey } = await deriveKeys(masterKeyBytes);
      const vaultKey = await decryptVaultKey(
        encryptionKey,
        user.encrypted_vault_key,
        user.vault_key_iv || user.kdf_params?.vault_key_iv || ""
      );

      set({
        vaultKey,
        encryptionKey,
        isVaultLocked: false,
        isLoading: false,
        authStage: 'ready',
      });
    } catch (error) {
      set({ isLoading: false, authStage: 'error' });
      throw new Error("Incorrect master password");
    }
  },

  lockVault: () => {
    // Explicitly wipe cryptographic keys from RAM
    set({
      vaultKey: null,
      encryptionKey: null,
      isVaultLocked: true,
      authStage: 'locked',
    });
  },

  logout: () => {
    setApiAuthToken(null);
    localStorage.removeItem('ciphershield_token');
    set({
      user: null,
      token: null,
      vaultKey: null,
      encryptionKey: null,
      isVaultLocked: true,
      authStage: 'idle',
      loginEmail: null,
    });
  },

  setUser: (user) => set({ user }),
}));
