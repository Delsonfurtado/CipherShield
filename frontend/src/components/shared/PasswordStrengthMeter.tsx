/**
 * CipherShield — Password Strength Meter
 * Real-time entropy scoring, crack time estimation, and pattern feedback using zxcvbn.
 */
import React, { useMemo } from 'react';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';
import { Progress } from '@/components/ui/progress';

// Configure zxcvbn options once
try {
  zxcvbnOptions.setOptions({
    translations: zxcvbnEnPackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
  });
} catch {
  // If already initialized
}

interface PasswordStrengthMeterProps {
  password: string;
  showFeedback?: boolean;
}

export function PasswordStrengthMeter({
  password,
  showFeedback = true,
}: PasswordStrengthMeterProps) {
  const result = useMemo(() => {
    if (!password) {
      return { score: 0, feedback: { warning: '', suggestions: [] }, crackTime: 'instant' };
    }
    try {
      const res = zxcvbn(password);
      return {
        score: res.score,
        feedback: res.feedback,
        crackTime: res.crackTimesDisplay.offlineSlowHashing1e4PerSecond || 'instant',
      };
    } catch {
      // Fallback simple length heuristic
      const len = password.length;
      const score = len < 8 ? 0 : len < 12 ? 1 : len < 16 ? 2 : len < 20 ? 3 : 4;
      return { score, feedback: { warning: '', suggestions: [] }, crackTime: 'variable' };
    }
  }, [password]);

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500',
  ];

  const scorePercent = ((result.score + 1) / 5) * 100;

  if (!password) return null;

  return (
    <div className="w-full space-y-1.5 mt-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Strength:</span>
        <span className="font-semibold text-foreground">
          {strengthLabels[result.score]}
          <span className="text-muted-foreground ml-1.5">
            (~{result.crackTime} to crack)
          </span>
        </span>
      </div>

      <Progress
        value={scorePercent}
        className="h-1.5"
        indicatorClassName={colors[result.score]}
      />

      {showFeedback && (result.feedback.warning || result.feedback.suggestions.length > 0) && (
        <div className="text-[11px] text-muted-foreground pt-1 space-y-0.5">
          {result.feedback.warning && (
            <p className="text-orange-500 font-medium">{result.feedback.warning}</p>
          )}
          {result.feedback.suggestions.map((s, idx) => (
            <p key={idx}>💡 {s}</p>
          ))}
        </div>
      )}
    </div>
  );
}
