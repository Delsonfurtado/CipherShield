/**
 * CipherShield — Zero-Knowledge Registration & Recovery Phrase Wizard
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Shield, KeyRound, Loader2, AlertCircle, Check, Copy, Download, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount, authStage } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      displayName: '',
    },
  });

  const watchPassword = watch('password', '');

  const onSubmit = async (values: any) => {
    setError(null);
    if (values.password !== values.confirmPassword) {
      setError('Master passwords do not match');
      return;
    }
    if (values.password.length < 12) {
      setError('Master password must be at least 12 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await registerAccount(values.email, values.password, values.displayName);
      setRecoveryPhrase(res.recoveryPhrase);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const copyPhrase = async () => {
    if (!recoveryPhrase) return;
    await navigator.clipboard.writeText(recoveryPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPhrase = () => {
    if (!recoveryPhrase) return;
    const blob = new Blob(
      [
        `CIPHERSHIELD EMERGENCY RECOVERY PHRASE\n\n` +
        `Keep this safe and offline. It can recover your encrypted vault if you forget your master password.\n\n` +
        `Words:\n${recoveryPhrase}\n\n` +
        `Generated: ${new Date().toISOString()}\n`
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ciphershield-recovery-phrase.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card/50 to-background select-none">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-2 shadow-lg">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {recoveryPhrase ? 'Save Your Recovery Phrase' : 'Create Zero-Knowledge Vault'}
          </h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {recoveryPhrase
              ? 'This 24-word key is the ONLY way to recover your vault if you lose your Master Password.'
              : 'Your master password stays on this device. Vault entries are encrypted before they are stored locally.'}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Wizard Step 1: Account Creation */}
        {!recoveryPhrase ? (
          <div className="p-6 rounded-2xl border bg-card/70 backdrop-blur-md shadow-xl space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Display Name</label>
                <Input {...register('displayName')} placeholder="Alex Morgan" />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address</label>
                <Input {...register('email', { required: true })} type="email" placeholder="name@example.com" required />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Master Password</label>
                <Input
                  {...register('password', { required: true })}
                  type="password"
                  placeholder="Min. 12 characters"
                  required
                />
                <PasswordStrengthMeter password={watchPassword} />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Confirm Master Password</label>
                <Input
                  {...register('confirmPassword', { required: true })}
                  type="password"
                  placeholder="Repeat master password"
                  required
                />
              </div>

              {loading && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-primary font-medium animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Deriving Argon2id keys & wrapping Vault Key...</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Generate Secure Vault</span>}
              </Button>
            </form>

            <div className="text-center pt-2 text-xs text-muted-foreground">
              Already have a vault?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Sign In
              </Link>
            </div>
          </div>
        ) : (
          /* Wizard Step 2: 24-Word Recovery Phrase Display */
          <div className="p-6 rounded-2xl border bg-card/70 backdrop-blur-md shadow-xl space-y-6">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-background/60 p-4 rounded-xl border font-mono text-xs">
              {recoveryPhrase.split(' ').map((word, idx) => (
                <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40">
                  <span className="text-[10px] text-muted-foreground">{idx + 1}.</span>
                  <span className="font-semibold text-foreground select-all">{word}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyPhrase} className="flex-1 gap-1.5 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied to Clipboard' : 'Copy Words'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={downloadPhrase} className="flex-1 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download Key File
              </Button>
            </div>

            <div className="flex items-start gap-2.5 pt-2">
              <Checkbox
                id="confirm-phrase"
                checked={confirmedSaved}
                onCheckedChange={(c) => setConfirmedSaved(!!c)}
              />
              <label htmlFor="confirm-phrase" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I have securely saved these 24 words offline. I understand CipherShield cannot recover my vault without them.
              </label>
            </div>

            <Button
              disabled={!confirmedSaved}
              onClick={() => navigate('/login')}
              className="w-full gap-2 font-semibold"
            >
              <span>Continue to Vault</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
