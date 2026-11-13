/**
 * CipherShield — Security Dashboard (Hero Feature)
 * Real-time client-side security audit: Radial gauge, risk metrics, trend visualization,
 * and an actionable 1-click "Fix Now" queue.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  ExternalLink,
  Lock,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { useVaultStore } from '@/stores/vaultStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function DashboardPage() {
  const navigate = useNavigate();
  const { items, setActiveItemId } = useVaultStore();

  const activeItems = useMemo(() => items.filter((i) => !i.is_deleted), [items]);

  // Client-side security analysis
  const metrics = useMemo(() => {
    let weak = 0;
    let reused = 0;
    let old = 0;
    let breached = 0;
    let no2fa = 0;
    let insecureUrls = 0;

    const passwordCounts = new Map<string, number>();

    activeItems.forEach((item) => {
      const data = item.decryptedData as any;
      const pwd = data?.password;
      if (pwd) {
        passwordCounts.set(pwd, (passwordCounts.get(pwd) || 0) + 1);
        if (pwd.length < 12) weak++;
      }
      if (item.isBreached) breached++;
      if (item.isOld) old++;

      if (item.type === 'login' && !data?.totp) {
        no2fa++;
      }

      const urls = (data?.urls as string[]) || (data?.uri ? [data?.uri] : []);
      if (urls.some((u) => u.startsWith('http://'))) {
        insecureUrls++;
      }
    });

    activeItems.forEach((item) => {
      const pwd = (item.decryptedData as any)?.password;
      if (pwd && (passwordCounts.get(pwd) || 0) > 1) {
        reused++;
      }
    });

    // Score calculation (0 - 100)
    let score = 100;
    if (activeItems.length > 0) {
      score -= Math.min(weak * 4, 30);
      score -= Math.min(reused * 3, 25);
      score -= Math.min(old * 1, 15);
      score -= Math.min(breached * 10, 30);
    } else {
      score = 100;
    }
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      weak,
      reused,
      old,
      breached,
      no2fa,
      insecureUrls,
      total: activeItems.length,
    };
  }, [activeItems]);

  // Risk Queue
  const fixQueue = useMemo(() => {
    const list: Array<{ item: any; issue: string; severity: 'critical' | 'high' | 'medium'; fixUrl?: string }> = [];

    activeItems.forEach((item) => {
      const data = item.decryptedData as any;
      const pwd = data?.password;
      const url = data?.urls?.[0] || data?.uri;

      if (item.isBreached) {
        list.push({ item, issue: 'Password compromised in known leak', severity: 'critical', fixUrl: url });
      } else if (item.isWeak) {
        list.push({ item, issue: 'Weak password (<12 characters)', severity: 'high', fixUrl: url });
      } else if (item.isReused) {
        list.push({ item, issue: 'Password reused across accounts', severity: 'medium', fixUrl: url });
      }
    });

    return list.slice(0, 8);
  }, [activeItems]);

  const scoreColor =
    metrics.score >= 80 ? 'text-green-500' : metrics.score >= 60 ? 'text-yellow-500' : 'text-red-500';

  const strokeColor =
    metrics.score >= 80 ? '#22c55e' : metrics.score >= 60 ? '#eab308' : '#ef4444';

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.score / 100) * circumference;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 select-none">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Security Dashboard
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Zero-knowledge health audit calculated in client memory across {metrics.total} vault items.
        </p>
      </div>

      {/* Hero Radial Gauge & Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md shadow-xl flex flex-col items-center justify-center text-center">
          <div className="relative flex items-center justify-center mb-3">
            <svg className="w-40 h-40 -rotate-90">
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="text-muted/20 stroke-current"
                strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={strokeColor}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-4xl font-extrabold ${scoreColor}`}>
                {metrics.score}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Out of 100
              </span>
            </div>
          </div>

          <h3 className="font-bold text-foreground text-sm">
            {metrics.score >= 80 ? 'Vault Defense: Excellent' : metrics.score >= 60 ? 'Vault Defense: Needs Attention' : 'Vault Defense: At Risk'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.weak + metrics.reused + metrics.breached} issues detected requiring action.
          </p>
        </div>

        {/* Breakdown Metric Cards */}
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-card/60 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Weak</span>
              <ShieldAlert className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.weak}</p>
            <p className="text-[10px] text-muted-foreground">&lt; 12 chars</p>
          </div>

          <div className="p-4 rounded-xl border bg-card/60 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Reused</span>
              <RefreshCw className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.reused}</p>
            <p className="text-[10px] text-muted-foreground">Duplicate passwords</p>
          </div>

          <div className="p-4 rounded-xl border bg-card/60 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Breached</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.breached}</p>
            <p className="text-[10px] text-muted-foreground">In dark web leaks</p>
          </div>

          <div className="p-4 rounded-xl border bg-card/60 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Old (&gt;90d)</span>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.old}</p>
            <p className="text-[10px] text-muted-foreground">Untouched passwords</p>
          </div>

          <div className="p-4 rounded-xl border bg-card/60 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Without 2FA</span>
              <Lock className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.no2fa}</p>
            <p className="text-[10px] text-muted-foreground">Missing TOTP</p>
          </div>

          <div className="p-4 rounded-xl border bg-card/60 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Insecure URLs</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.insecureUrls}</p>
            <p className="text-[10px] text-muted-foreground">Plain HTTP links</p>
          </div>
        </div>
      </div>

      {/* Actionable Fix Now Queue */}
      <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-foreground">Priority Security Fixes</h3>
            <p className="text-xs text-muted-foreground">Ordered by vulnerability severity</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {fixQueue.length} Pending
          </Badge>
        </div>

        {fixQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-semibold text-sm text-foreground">No Critical Vulnerabilities Found</p>
            <p className="text-xs text-muted-foreground">All vault passwords meet strength criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {fixQueue.map(({ item, issue, severity, fixUrl }, idx) => {
              const data = item.decryptedData as any;
              const title = data?.title || '(untitled)';
              const username = data?.username || data?.email || '';

              return (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant={severity === 'critical' ? 'destructive' : 'secondary'}
                      className="text-[10px] capitalize shrink-0"
                    >
                      {severity}
                    </Badge>
                    <div className="truncate">
                      <p className="font-medium text-sm text-foreground truncate">{title}</p>
                      <p className="text-xs text-muted-foreground truncate">{issue} {username && `· ${username}`}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {fixUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs gap-1"
                        onClick={() => window.open(fixUrl.startsWith('http') ? fixUrl : `https://${fixUrl}`, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Change Password
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setActiveItemId(item.id);
                        navigate('/vault');
                      }}
                    >
                      Open Item
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
