/**
 * CipherShield — Live Rotating TOTP Authenticator Component
 * Evaluates RFC 6238 TOTP codes with a 30-second animated SVG countdown ring.
 */
import React, { useState, useEffect } from 'react';
import { CopyButton } from '@/components/shared/CopyButton';
import { Shield } from 'lucide-react';

interface TOTPWidgetProps {
  secret: string;
  issuer?: string;
  accountName?: string;
}

// RFC 6238 TOTP generator via Web Crypto API
async function generateTOTP(secretBase32: string): Promise<{ code: string; secondsRemaining: number }> {
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const counter = Math.floor(epoch / timeStep);
  const secondsRemaining = timeStep - (epoch % timeStep);

  try {
    // Base32 decode
    const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    const cleanSecret = secretBase32.replace(/[\s-]/g, "").toUpperCase();
    for (let i = 0; i < cleanSecret.length; i++) {
      const val = base32chars.indexOf(cleanSecret.charAt(i));
      if (val >= 0) {
        bits += val.toString(2).padStart(5, "0");
      }
    }

    const keyBytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < keyBytes.length; i++) {
      keyBytes[i] = parseInt(bits.substr(i * 8, 8), 2);
    }

    // Counter buffer (8 bytes big endian)
    const counterBytes = new Uint8Array(8);
    let tempCounter = counter;
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = tempCounter & 0xff;
      tempCounter = tempCounter >> 8;
    }

    // HMAC-SHA1
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: { name: "SHA-1" } },
      false,
      ["sign"]
    );

    const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
    const hmacResult = new Uint8Array(signature);

    // Dynamic truncation
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = binary % 1000000;
    const code = otp.toString().padStart(6, "0");
    return { code, secondsRemaining };
  } catch (e) {
    return { code: "------", secondsRemaining: 30 };
  }
}

export function TOTPWidget({ secret, issuer, accountName }: TOTPWidgetProps) {
  const [totpCode, setTotpCode] = useState('------');
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    let mounted = true;

    const updateCode = async () => {
      const { code, secondsRemaining } = await generateTOTP(secret);
      if (mounted) {
        setTotpCode(code);
        setTimeLeft(secondsRemaining);
      }
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [secret]);

  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / 30) * circumference;
  const isUrgent = timeLeft <= 5;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
      <div className="flex items-center gap-3">
        {/* Countdown Ring */}
        <div className="relative flex items-center justify-center h-9 w-9">
          <svg className="w-9 h-9 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r={radius}
              className="text-muted/30 stroke-current"
              strokeWidth="3"
              fill="transparent"
            />
            <circle
              cx="18"
              cy="18"
              r={radius}
              className={`transition-all duration-1000 ${
                isUrgent ? 'text-destructive stroke-current' : 'text-primary stroke-current'
              }`}
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <span className="absolute text-[10px] font-mono font-bold text-muted-foreground">
            {timeLeft}s
          </span>
        </div>

        {/* Formatted Code: 123 456 */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono font-bold tracking-widest text-foreground select-all">
              {totpCode.slice(0, 3)} {totpCode.slice(3)}
            </span>
          </div>
          {accountName && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
              {accountName}
            </span>
          )}
        </div>
      </div>

      <CopyButton text={totpCode} label="Copy" size="sm" variant="outline" />
    </div>
  );
}
