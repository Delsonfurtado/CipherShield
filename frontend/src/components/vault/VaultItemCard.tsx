/**
 * VaultItemCard – Sortable vault item row.
 * Provides hover-reveal copy buttons, right-click context menu,
 * security warning badges, and keyboard accessibility.
 */
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Copy,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Edit2,
  Trash2,
  Copy as CopyIcon,
  FolderInput,
  Share2,
  ShieldAlert,
  RefreshCw,
  Clock,
  AlertTriangle,
  Lock,
  FileText,
  CreditCard,
  User,
  Key,
  Wifi,
  GripVertical,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DecryptedVaultItem, ItemType } from '@/types/vault';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getTypeIcon(type: ItemType) {
  const cls = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'login':
      return <Lock className={cls} />;
    case 'note':
      return <FileText className={cls} />;
    case 'card':
      return <CreditCard className={cls} />;
    case 'identity':
      return <User className={cls} />;
    case 'api_key':
      return <Key className={cls} />;
    case 'wifi':
      return <Wifi className={cls} />;
  }
}

function getTypeColor(type: ItemType): string {
  switch (type) {
    case 'login':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    case 'note':
      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
    case 'card':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
    case 'identity':
      return 'bg-green-500/10 text-green-600 dark:text-green-400';
    case 'api_key':
      return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
    case 'wifi':
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';
  }
}

function getTypeLabel(type: ItemType): string {
  const labels: Record<ItemType, string> = {
    login: 'Login',
    note: 'Secure Note',
    card: 'Credit Card',
    identity: 'Identity',
    api_key: 'API Key',
    wifi: 'Wi-Fi',
  };
  return labels[type];
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// ---------------------------------------------------------------------------
// Security badge
// ---------------------------------------------------------------------------
function SecurityBadge({
  type,
}: {
  type: 'weak' | 'reused' | 'old' | 'breached';
}) {
  const configs = {
    weak: {
      icon: <ShieldAlert className="h-3 w-3" />,
      label: 'Weak',
      cls: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
    },
    reused: {
      icon: <RefreshCw className="h-3 w-3" />,
      label: 'Reused',
      cls: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    },
    old: {
      icon: <Clock className="h-3 w-3" />,
      label: 'Old',
      cls: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    breached: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Breached',
      cls: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    },
  };
  const cfg = configs[type];
  return (
    <span
      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Favicon component
// ---------------------------------------------------------------------------
function Favicon({
  type,
}: {
  type: ItemType;
}) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${getTypeColor(type)}`}
    >
      {getTypeIcon(type)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface VaultItemCardProps {
  item: DecryptedVaultItem;
  isSelected: boolean;
  isActive: boolean;
  isBulkMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function VaultItemCard({
  item,
  isSelected,
  isActive,
  isBulkMode,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
  onDuplicate,
}: VaultItemCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const data = item.decryptedData as Record<string, unknown>;
  const title = (data['title'] as string) ?? '(untitled)';
  const username = (data['username'] as string) ?? (data['email'] as string) ?? '';
  const password = (data['password'] as string) ?? '';

  const handleCopy = useCallback(
    async (field: string, value: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await copyToClipboard(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    },
    [],
  );

  const lastUsedDate = item.last_used_at ? new Date(item.last_used_at) : null;
  const timeAgo = lastUsedDate && !Number.isNaN(lastUsedDate.getTime())
    ? formatDistanceToNow(lastUsedDate, { addSuffix: true })
    : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          ref={setNodeRef}
          style={style}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0 },
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect();
          }}
          tabIndex={0}
          role="button"
          aria-pressed={isActive}
          aria-label={`${title} — ${getTypeLabel(item.type)}`}
          className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary ${
            isActive
              ? 'border-primary/40 bg-primary/5 shadow-sm'
              : 'border-transparent hover:border-border hover:bg-muted/50'
          } ${isSelected ? 'border-primary/30 bg-primary/5' : ''}`}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none opacity-0 group-hover:opacity-30 active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Bulk checkbox */}
          {isBulkMode && (
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect()}
                aria-label={`Select ${title}`}
              />
            </div>
          )}

          {/* Favicon / icon */}
          <Favicon type={item.type} />

          {/* Main content */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-sm">{title}</span>
              <Badge
                variant="secondary"
                className={`shrink-0 rounded px-1.5 py-0 text-[10px] font-medium ${getTypeColor(item.type)}`}
              >
                {getTypeLabel(item.type)}
              </Badge>
              {item.is_favorite && (
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              {username && (
                <span className="truncate text-xs text-muted-foreground">
                  {username}
                </span>
              )}
              {timeAgo && (
                <span className="shrink-0 text-xs text-muted-foreground/60">
                  · {timeAgo}
                </span>
              )}
            </div>
            {/* Security badges */}
            {(item.isWeak || item.isReused || item.isOld || item.isBreached) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.isBreached && <SecurityBadge type="breached" />}
                {item.isWeak && <SecurityBadge type="weak" />}
                {item.isReused && <SecurityBadge type="reused" />}
                {item.isOld && <SecurityBadge type="old" />}
              </div>
            )}
          </div>

          {/* Hover action buttons */}
          <TooltipProvider>
            <div
              className={`flex items-center gap-1 transition-opacity ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {username && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => handleCopy('username', username, e)}
                      aria-label="Copy username"
                    >
                      {copiedField === 'username' ? (
                        <span className="text-[9px] font-bold text-primary">✓</span>
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy username</TooltipContent>
                </Tooltip>
              )}
              {password && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => handleCopy('password', password, e)}
                      aria-label="Copy password"
                    >
                      {copiedField === 'password' ? (
                        <span className="text-[9px] font-bold text-primary">✓</span>
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy password</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    aria-label="Edit item"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </motion.div>
      </ContextMenuTrigger>

      {/* Context menu */}
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onEdit}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleFavorite}>
          {item.is_favorite ? (
            <StarOff className="mr-2 h-4 w-4" />
          ) : (
            <Star className="mr-2 h-4 w-4" />
          )}
          {item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        </ContextMenuItem>
        <ContextMenuItem>
          <FolderInput className="mr-2 h-4 w-4" />
          Move to folder
        </ContextMenuItem>
        <ContextMenuItem>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
