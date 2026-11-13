import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  clearAfterSeconds?: number;
}

export function CopyButton({
  text,
  label,
  className,
  size = 'icon',
  variant = 'ghost',
  clearAfterSeconds = 30,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { setClipboardWarning } = useUIStore();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setClipboardWarning(`Copied! Clipboard will automatically clear in ${clearAfterSeconds} seconds.`);

    // Auto-clear clipboard after timeout
    setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === text) {
          await navigator.clipboard.writeText('');
          setClipboardWarning('Clipboard cleared for security.');
          setTimeout(() => setClipboardWarning(null), 3000);
        }
      } catch {
        // Read permission may be denied
      }
    }, clearAfterSeconds * 1000);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={handleCopy}
      aria-label={label || 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500 stroke-[2.5]" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {label && <span className="ml-1.5">{label}</span>}
    </Button>
  );
}
