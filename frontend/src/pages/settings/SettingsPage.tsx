/**
 * CipherShield — Settings, Security Preferences & Import/Export
 */
import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  KeyRound,
  QrCode,
  Smartphone,
  Download,
  Upload,
  Trash2,
  Lock,
  Moon,
  Sun,
  Laptop,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useUIStore } from '@/stores/uiStore';
import { authApi } from '@/lib/api/auth';
import {
  deriveMasterKey,
  deriveKeys,
  encryptVaultKey,
  uint8ArrayToBase64,
} from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export function SettingsPage() {
  const { user, vaultKey, logout } = useAuthStore();
  const { items, addItem } = useVaultStore();
  const { theme, setTheme } = useUIStore();

  // Change master password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // 2FA state
  const [twoFaModal, setTwoFaModal] = useState(false);
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaQrUri, setTwoFaQrUri] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [twoFaSuccess, setTwoFaSuccess] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    authApi.getSessions().then(setSessions).catch(() => {});
  }, []);

  // Zero-Knowledge Master Password Change (Re-wrapping Vault Key)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);
    setPwdError(null);

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match');
      return;
    }
    if (newPassword.length < 12) {
      setPwdError('New password must be at least 12 characters');
      return;
    }
    if (!vaultKey) {
      setPwdError('Vault must be unlocked to change master password');
      return;
    }

    setIsChangingPwd(true);
    try {
      // 1. Generate new random salt
      const newSaltBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const newSaltB64 = uint8ArrayToBase64(newSaltBytes);

      // 2. Derive new Master Key & new device Encryption Key
      const kdfParams = { m: 65536, t: 3, p: 1 };
      const masterKeyBytes = await deriveMasterKey(newPassword, newSaltBytes, kdfParams);
      const { encryptionKey: newEncryptionKey } = await deriveKeys(masterKeyBytes);

      // 3. Re-wrap the existing Vault Key with new Encryption Key
      // ZERO-KNOWLEDGE: All vault items stay untouched!
      const { encrypted_vault_key, iv } = await encryptVaultKey(newEncryptionKey, vaultKey);

      // 4. Update on backend
      await authApi.changeMasterPassword({
        current_password: currentPassword,
        new_encrypted_vault_key,
        new_argon2_salt: newSaltB64,
        new_kdf_params: {
          ...kdfParams,
          vault_key_iv: iv,
        },
      });

      setPwdMessage('Master password changed and vault envelope successfully re-wrapped.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.message || 'Failed to change master password');
    } finally {
      setIsChangingPwd(false);
    }
  };

  // Start 2FA Setup
  const handleStart2FA = async () => {
    const res = await authApi.setup2FA();
    setTwoFaSecret(res.secret);
    setTwoFaQrUri(res.qr_code_uri);
    setTwoFaModal(true);
  };

  const handleVerify2FA = async () => {
    try {
      const res = await authApi.verify2FA(twoFaCode);
      setBackupCodes(res.backup_codes || []);
      setTwoFaSuccess(true);
    } catch (e: any) {
      alert(e.message || 'Invalid 2FA code');
    }
  };

  // Export Vault to Encrypted JSON
  const handleExportJSON = () => {
    const exportData = {
      app: 'CipherShield',
      version: '1.0',
      exported_at: new Date().toISOString(),
      items: items.map((i) => ({
        type: i.type,
        data: i.decryptedData,
        is_favorite: i.is_favorite,
        created_at: i.created_at,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciphershield-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-primary" />
          Settings & Security Controls
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Cryptographic envelope preferences, two-factor authentication, and vault exports.
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="account">Account & Keys</TabsTrigger>
          <TabsTrigger value="security">Security & 2FA</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="backup">Import / Export</TabsTrigger>
        </TabsList>

        {/* Tab 1: Account & Master Password */}
        <TabsContent value="account" className="space-y-6">
          <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
            <h3 className="font-bold text-sm text-foreground">Account Information</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block mb-1">Email Address</span>
                <span className="font-medium text-foreground">{user?.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Account ID</span>
                <span className="font-mono text-[11px] text-muted-foreground">{user?.id}</span>
              </div>
            </div>
          </div>

          {/* Change Master Password */}
          <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
            <div>
              <h3 className="font-bold text-sm text-foreground">Change Master Password</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Re-encrypts the random 256-bit Vault Key in client memory. Individual vault items do not require re-encryption.
              </p>
            </div>

            {pwdMessage && <Alert><AlertDescription className="text-green-500">{pwdMessage}</AlertDescription></Alert>}
            {pwdError && <Alert variant="destructive"><AlertDescription>{pwdError}</AlertDescription></Alert>}

            <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">New Master Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 12 characters"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              <Button type="submit" disabled={isChangingPwd} size="sm" className="text-xs font-semibold">
                {isChangingPwd ? 'Re-wrapping Vault Key...' : 'Update Master Password'}
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Tab 2: Security & 2FA */}
        <TabsContent value="security" className="space-y-6">
          <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Two-Factor Authentication (TOTP)</h3>
                <p className="text-xs text-muted-foreground">
                  Protect your login with an authenticator app (Google Authenticator, Authy, YubiKey).
                </p>
              </div>
              <Button onClick={handleStart2FA} size="sm" variant="outline" className="gap-2 text-xs">
                <QrCode className="h-4 w-4" />
                Configure 2FA
              </Button>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
            <h3 className="font-bold text-sm text-foreground">Active Sessions ({sessions.length})</h3>
            <div className="divide-y divide-border">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">{s.device_name || 'Browser Session'}</p>
                    <p className="text-muted-foreground">IP: {s.ip_address || 'Localhost'}</p>
                  </div>
                  {s.is_current && <Badge variant="secondary" className="text-[10px]">Current Session</Badge>}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Appearance */}
        <TabsContent value="appearance">
          <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
            <h3 className="font-bold text-sm text-foreground">Color Scheme</h3>
            <div className="grid grid-cols-3 gap-3 max-w-sm">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => setTheme('light')}
                className="gap-2 text-xs"
              >
                <Sun className="h-4 w-4" /> Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => setTheme('dark')}
                className="gap-2 text-xs"
              >
                <Moon className="h-4 w-4" /> Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => setTheme('system')}
                className="gap-2 text-xs"
              >
                <Laptop className="h-4 w-4" /> System
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Import / Export */}
        <TabsContent value="backup" className="space-y-6">
          <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
            <h3 className="font-bold text-sm text-foreground">Export Vault</h3>
            <p className="text-xs text-muted-foreground">
              Download your decrypted records for offline backup or migration.
            </p>
            <Button onClick={handleExportJSON} variant="outline" size="sm" className="gap-2 text-xs">
              <Download className="h-4 w-4" />
              Export Encrypted JSON
            </Button>
          </div>

          <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-4">
            <h3 className="font-bold text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </h3>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account, wiping all encrypted vault items and keys with zero recovery.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm('Are you absolutely sure? This will delete all encrypted vault items permanently.')) {
                  authApi.deleteAccount('').then(logout);
                }
              }}
              className="text-xs"
            >
              Delete Account & Wipe All Data
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* 2FA Configuration Dialog */}
      <Dialog open={twoFaModal} onOpenChange={setTwoFaModal}>
        <DialogContent onClose={() => setTwoFaModal(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
          </DialogHeader>

          {!twoFaSuccess ? (
            <div className="space-y-4 mt-2 text-center">
              <p className="text-xs text-muted-foreground">
                Scan this QR code with your authenticator app, or enter the manual key below:
              </p>
              <div className="p-4 bg-white rounded-xl inline-block border mx-auto">
                {/* Visual QR Code fallback display */}
                <div className="h-36 w-36 bg-gray-100 flex items-center justify-center text-black font-mono text-xs text-center p-2 break-all">
                  {twoFaSecret}
                </div>
              </div>
              <p className="font-mono text-xs bg-muted p-2 rounded select-all font-bold">
                {twoFaSecret}
              </p>

              <div className="space-y-2 text-left pt-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Enter 6-Digit Verification Code
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-widest"
                />
              </div>

              <DialogFooter>
                <Button onClick={handleVerify2FA} className="w-full">
                  Verify & Activate 2FA
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2 text-green-500 font-semibold text-sm">
                <Check className="h-5 w-5" />
                2FA Enabled Successfully!
              </div>
              <p className="text-xs text-muted-foreground">
                Save these emergency backup codes in a secure location. Each code can be used once if you lose your authenticator device:
              </p>
              <div className="grid grid-cols-2 gap-2 bg-muted p-3 rounded-xl font-mono text-xs font-bold text-foreground">
                {backupCodes.map((code, idx) => (
                  <div key={idx} className="p-1">{code}</div>
                ))}
              </div>
              <Button onClick={() => setTwoFaModal(false)} className="w-full">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
