/**
 * CipherShield — Vault Item Detail Panel
 * Field viewers, show/hide secrets, live TOTP rotating widget, and audit/history viewer.
 */
import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  Share2,
  History,
  Star,
  StarOff,
  Lock,
  Globe,
  Clock,
  User,
  Key,
  Shield,
  FileText,
  CreditCard,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CopyButton } from '@/components/shared/CopyButton';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';
import { TOTPWidget } from '@/components/authenticator/TOTPWidget';
import { useVaultStore } from '@/stores/vaultStore';
import { useUIStore } from '@/stores/uiStore';
import type { DecryptedVaultItem } from '@/types/vault';
import { formatDistanceToNow } from 'date-fns';

interface VaultItemDetailProps {
  item: DecryptedVaultItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export function VaultItemDetail({ item, onClose, onEdit, onDelete }: VaultItemDetailProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { deleteItem, toggleFavorite } = useVaultStore();
  const data = (item.decryptedData || {}) as Record<string, any>;

  const title = data.title || '(untitled)';
  const username = data.username || data.email || '';
  const password = data.password || '';
  const urls = (data.urls as string[]) || (data.uri ? [data.uri] : []);
  const notes = data.notes || data.content || '';
  const totpSecret = data.totp || '';
  const customFields = data.customFields || [];
  const updatedDate = item.updated_at ? new Date(item.updated_at) : null;
  const updatedLabel = updatedDate && !Number.isNaN(updatedDate.getTime())
    ? formatDistanceToNow(updatedDate, { addSuffix: true })
    : 'date unavailable';

  const primaryUrl = urls.length > 0 ? urls[0] : null;

  return (
    <div className="h-full flex flex-col bg-card/60 backdrop-blur-md border-l select-text">
      {/* Detail Header */}
      <div className="p-6 border-b space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs uppercase tracking-wider font-mono">
            {item.type}
          </Badge>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => toggleFavorite(item.id)}
            >
              {item.is_favorite ? (
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              ) : (
                <StarOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
              <Edit2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (onDelete) {
                  onDelete();
                } else {
                  deleteItem(item.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <h2 className="text-xl font-bold text-foreground truncate">{title}</h2>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {updatedLabel}</span>
        </div>
      </div>

      {/* Detail Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Username / Email */}
        {username && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Username / Email
            </span>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background/50">
              <span className="text-sm font-medium text-foreground select-all">{username}</span>
              <CopyButton text={username} />
            </div>
          </div>
        )}

        {/* Password */}
        {password && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Password
            </span>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background/50">
              <span className="text-sm font-mono tracking-wider text-foreground select-all">
                {showPassword ? password : '••••••••••••••••'}
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
                <CopyButton text={password} />
              </div>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>
        )}

        {/* Live Authenticator TOTP */}
        {totpSecret && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              One-Time Password (TOTP)
            </span>
            <TOTPWidget secret={totpSecret} issuer={title} accountName={username} />
          </div>
        )}

        {/* Websites / URLs */}
        {urls.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Website
            </span>
            {urls.map((u, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg border bg-background/50 text-sm"
              >
                <a
                  href={u.startsWith('http') ? u : `https://${u}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary hover:underline flex items-center gap-1.5 max-w-[260px]"
                >
                  <span className="truncate">{u}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
                <CopyButton text={u} />
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Secure Notes
            </span>
            <div className="p-3 rounded-lg border bg-background/50 text-sm whitespace-pre-wrap font-sans text-muted-foreground">
              {notes}
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Custom Fields</span>
            {customFields.map((field: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg border bg-background/50 text-xs">
                <span className="font-semibold text-muted-foreground">{field.label}:</span>
                <span className="font-mono text-foreground">{field.value}</span>
                <CopyButton text={field.value} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      {primaryUrl && (
        <div className="p-4 border-t bg-muted/20">
          <Button
            variant="outline"
            className="w-full text-xs gap-1.5"
            onClick={() => {
              const url = primaryUrl.startsWith('http') ? primaryUrl : `https://${primaryUrl}`;
              window.open(url, '_blank');
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Launch Website & Autofill
          </Button>
        </div>
      )}
    </div>
  );
}
