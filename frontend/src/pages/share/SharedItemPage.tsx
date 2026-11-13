/**
 * CipherShield — Public Zero-Knowledge Shared Item Page
 * Decryption key resides strictly in the URL hash fragment (#key=...)
 * which is NEVER transmitted over the wire or logged by servers.
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, AlertCircle, Clock } from 'lucide-react';
import { shareApi } from '@/lib/api/share';
import { decryptVaultItem, base64ToUint8Array } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/shared/CopyButton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SharedItemPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [sharedPayload, setSharedPayload] = useState<any>(null);
  const [decryptedData, setDecryptedData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Extract key from URL fragment #key=...
  const getFragmentKey = (): string | null => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('key');
  };

  const loadSharedData = async (enteredPassphrase?: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await shareApi.getSharedItem(id, enteredPassphrase);
      setSharedPayload(res);

      // Decrypt using fragment key
      const keyBase64 = getFragmentKey();
      if (!keyBase64) {
        throw new Error("Missing decryption key in URL fragment. Ensure you copied the entire link.");
      }

      // Import key
      const rawKey = base64ToUint8Array(keyBase64);
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const decrypted = await decryptVaultItem(cryptoKey, res.encrypted_data);
      setDecryptedData(decrypted);
    } catch (e: any) {
      if (e.message && e.message.includes('Passphrase required')) {
        setNeedsPassphrase(true);
      } else {
        setError(e.message || "Failed to retrieve shared item. It may have expired or reached max views.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSharedData();
  }, [id]);

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card/50 to-background select-none">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-2 shadow-lg">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Zero-Knowledge Secure Share
          </h1>
          <p className="text-xs text-muted-foreground">
            Decrypted client-side. The CipherShield server never possesses the decryption key.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {needsPassphrase && !decryptedData && (
          <div className="p-6 rounded-2xl border bg-card/70 backdrop-blur-md shadow-xl space-y-4">
            <p className="text-xs text-muted-foreground">
              This shared item is protected by a passphrase set by the sender:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadSharedData(passphrase);
              }}
              className="space-y-3"
            >
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                required
              />
              <Button type="submit" className="w-full">
                Unlock Secret
              </Button>
            </form>
          </div>
        )}

        {decryptedData && (
          <div className="p-6 rounded-2xl border bg-card/70 backdrop-blur-md shadow-xl space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Item Title</span>
              <p className="font-bold text-lg text-foreground">{decryptedData.title || '(untitled)'}</p>
            </div>

            {decryptedData.username && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Username / Email</span>
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background/50">
                  <span className="text-sm font-medium">{decryptedData.username}</span>
                  <CopyButton text={decryptedData.username} />
                </div>
              </div>
            )}

            {decryptedData.password && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Password</span>
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background/50">
                  <span className="text-sm font-mono tracking-wider">
                    {showPassword ? decryptedData.password : '••••••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <CopyButton text={decryptedData.password} />
                  </div>
                </div>
              </div>
            )}

            {decryptedData.notes && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Notes</span>
                <div className="p-3 rounded-lg border bg-background/50 text-xs text-muted-foreground whitespace-pre-wrap">
                  {decryptedData.notes}
                </div>
              </div>
            )}

            <div className="pt-2 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                Views remaining: {sharedPayload?.max_views ? sharedPayload.max_views - sharedPayload.view_count : 'Unlimited'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
