/**
 * CipherShield — Zero-Knowledge Login & Vault Unlock Page
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Shield, Lock, KeyRound, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, unlockVault, authStage, user, isVaultLocked } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [emailFor2FA, setEmailFor2FA] = useState('');
  const [masterPasswordFor2FA, setMasterPasswordFor2FA] = useState('');

  const { register, handleSubmit } = useForm({
    defaultValues: {
      email: '',
      password: '',
      totpCode: '',
    },
  });

  const getStageMessage = () => {
    switch (authStage) {
      case 'deriving_keys':
        return 'Deriving Argon2id cryptographic keys (64MB memory cost)...';
      case 'authenticating':
        return 'Authenticating with server envelope...';
      case 'decrypting_vault':
        return 'Decrypting zero-knowledge Vault Key...';
      default:
        return 'Authenticating...';
    }
  };

  const onSubmit = async (values: any) => {
    setError(null);
    setLoading(true);

    try {
      if (user && isVaultLocked) {
        // Vault unlock mode
        await unlockVault(values.password);
        navigate('/vault');
        return;
      }

      if (needs2FA) {
        // Submit with 2FA code
        await login(emailFor2FA, masterPasswordFor2FA, values.totpCode);
        navigate('/vault');
        return;
      }

      const res = await login(values.email, values.password);
      if (res.requires2FA) {
        setNeeds2FA(true);
        setEmailFor2FA(values.email);
        setMasterPasswordFor2FA(values.password);
      } else {
        navigate('/vault');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card/50 to-background select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-2 shadow-lg">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {user && isVaultLocked ? 'Unlock Your Vault' : 'Sign in to CipherShield'}
          </h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {user && isVaultLocked
              ? `Session active for ${user.email}. Enter your Master Password to decrypt keys.`
              : 'Zero-Knowledge Security Suite. Plaintext passwords never leave your device.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Form Container */}
        <div className="p-6 rounded-2xl border bg-card/70 backdrop-blur-md shadow-xl space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!user && !needs2FA && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Email Address
                </label>
                <Input
                  {...register('email', { required: true })}
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            )}

            {!needs2FA && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Master Password
                </label>
                <Input
                  {...register('password', { required: true })}
                  type="password"
                  placeholder="••••••••••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            {needs2FA && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Two-Factor Authentication Code
                </label>
                <Input
                  {...register('totpCode', { required: true })}
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  autoFocus
                  className="text-center tracking-widest font-mono text-lg"
                  required
                />
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-primary font-medium animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>{getStageMessage()}</span>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{user && isVaultLocked ? 'Unlock Vault' : needs2FA ? 'Verify 2FA' : 'Sign In'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {!user && (
            <div className="text-center pt-2 text-xs text-muted-foreground">
              Don't have an account yet?{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Create Vault
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
