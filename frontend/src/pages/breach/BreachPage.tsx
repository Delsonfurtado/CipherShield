/**
 * CipherShield — Breach & Leak Monitoring Page
 * k-anonymity Pwned Passwords checker & Dark Web email exposure monitor.
 */
import React, { useState, useEffect } from 'react';
import {
  Radio,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Search,
  CheckCircle2,
  Lock,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { breachApi } from '@/lib/api/breach';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// SHA-1 helper for k-anonymity
async function sha1Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await window.crypto.subtle.digest("SHA-1", enc.encode(str));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function BreachPage() {
  const { user } = useAuthStore();
  const { items } = useVaultStore();

  const [isScanning, setIsScanning] = useState(false);
  const [emailBreaches, setEmailBreaches] = useState<any[]>([]);
  const [breachedPasswordCount, setBreachedPasswordCount] = useState<number | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [customCheckResult, setCustomCheckResult] = useState<{ checked: boolean; pwned: boolean; count: number } | null>(null);

  // Initial load
  useEffect(() => {
    if (user?.email) {
      breachApi.checkEmailBreaches(user.email).then((res) => {
        setEmailBreaches(res.breaches || []);
      }).catch(() => {});
    }
  }, [user]);

  // Zero-Knowledge k-anonymity vault password scan
  const scanVaultPasswords = async () => {
    setIsScanning(true);
    let breached = 0;

    try {
      const activeItems = items.filter((i) => !i.is_deleted);
      for (const item of activeItems) {
        const pwd = (item.decryptedData as any)?.password;
        if (!pwd) continue;

        const fullHash = await sha1Hex(pwd);
        const prefix = fullHash.slice(0, 5);
        const suffix = fullHash.slice(5);

        // Fetch range from HIBP via privacy-safe proxy
        const responseText = await breachApi.checkPwnedPasswordPrefix(prefix);
        const lines = responseText.split('\n');

        let found = false;
        for (const line of lines) {
          const [hashSuffix] = line.trim().split(':');
          if (hashSuffix === suffix) {
            found = true;
            item.isBreached = true;
            breached++;
            break;
          }
        }
      }
      setBreachedPasswordCount(breached);
    } catch (e) {
      console.error("Breach scan error:", e);
    } finally {
      setIsScanning(false);
    }
  };

  const checkSinglePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPassword) return;

    const fullHash = await sha1Hex(customPassword);
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);

    try {
      const responseText = await breachApi.checkPwnedPasswordPrefix(prefix);
      const lines = responseText.split('\n');
      let count = 0;
      let pwned = false;

      for (const line of lines) {
        const [hashSuffix, countStr] = line.trim().split(':');
        if (hashSuffix === suffix) {
          pwned = true;
          count = parseInt(countStr || '1', 10);
          break;
        }
      }
      setCustomCheckResult({ checked: true, pwned, count });
    } catch {
      setCustomCheckResult({ checked: true, pwned: false, count: 0 });
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Radio className="h-6 w-6 text-destructive" />
            Breach & Leak Monitoring
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Zero-knowledge k-anonymity Pwned Passwords verification & HIBP exposure feeds.
          </p>
        </div>
        <Button
          onClick={scanVaultPasswords}
          disabled={isScanning}
          className="gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Scan All Vault Passwords'}</span>
        </Button>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-muted-foreground">Email Exposure Status</span>
            {emailBreaches.length > 0 ? (
              <Badge variant="destructive" className="text-xs">Exposed</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs text-green-500">Secure</Badge>
            )}
          </div>
          <p className="text-xl font-bold text-foreground truncate">{user?.email}</p>
          <p className="text-xs text-muted-foreground">
            {emailBreaches.length > 0
              ? `Found in ${emailBreaches.length} known dark web breach databases.`
              : 'No known exposures found for your primary email.'}
          </p>
        </div>

        <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-muted-foreground">Pwned Passwords Check</span>
            <Badge variant="outline" className="text-[10px] font-mono">k-Anonymity</Badge>
          </div>
          <p className="text-xl font-bold text-foreground">
            {breachedPasswordCount === null ? (
              'Not scanned yet'
            ) : breachedPasswordCount === 0 ? (
              <span className="text-green-500 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> All Vault Passwords Safe
              </span>
            ) : (
              <span className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> {breachedPasswordCount} Passwords Compromised
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            First 5 hash characters are sent via SHA-1 range query. The server never learns the password.
          </p>
        </div>
      </div>

      {/* Standalone Instant Check Tool */}
      <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
        <h3 className="font-bold text-sm text-foreground">Instant Password Breach Check</h3>
        <p className="text-xs text-muted-foreground">
          Test any password immediately against over 800 million exposed credentials.
        </p>

        <form onSubmit={checkSinglePassword} className="flex gap-3">
          <Input
            type="password"
            value={customPassword}
            onChange={(e) => setCustomPassword(e.target.value)}
            placeholder="Type a password to test safely..."
            className="flex-1 font-mono text-sm"
          />
          <Button type="submit" variant="secondary" className="text-xs">
            Test Password
          </Button>
        </form>

        {customCheckResult?.checked && (
          <div className="p-3 rounded-lg border text-xs">
            {customCheckResult.pwned ? (
              <p className="text-destructive font-semibold">
                ⚠️ Compromised! This password was seen {customCheckResult.count.toLocaleString()} times in known breaches.
              </p>
            ) : (
              <p className="text-green-500 font-semibold">
                ✓ Good news! This password does not appear in known exposed databases.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dark Web Alert Center */}
      <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground">Breach Incident Registry</h3>
          <span className="text-xs text-muted-foreground">{emailBreaches.length} Incidents</span>
        </div>

        {emailBreaches.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No public exposures recorded for your account.
          </p>
        ) : (
          <div className="space-y-4">
            {emailBreaches.map((b, idx) => (
              <div key={idx} className="p-4 rounded-xl border bg-background/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{b.Title || b.Name}</span>
                    <Badge variant="outline" className="text-[10px]">{b.Domain}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {b.BreachDate}
                  </span>
                </div>
                <div
                  className="text-xs text-muted-foreground prose dark:prose-invert max-w-none text-left"
                  dangerouslySetInnerHTML={{ __html: b.Description }}
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {(b.DataClasses || []).map((dc: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                      {dc}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
