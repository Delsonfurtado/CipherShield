/**
 * CipherShield — Password Generator Page
 * 4 generation modes (Random, Passphrase, PIN, Pronounceable), CSPRNG-only entropy,
 * crack time estimation, copy auto-clear, and in-memory session history.
 */
import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  RefreshCw,
  Copy,
  Plus,
  Sliders,
  History,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';
import { CopyButton } from '@/components/shared/CopyButton';
import { useUIStore } from '@/stores/uiStore';

const WORDS = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
  "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
  "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
  "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album",
  "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone",
  "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among",
  "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry",
  "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
  "apple", "arctic", "armor", "arrow", "artist", "atom", "attack", "august",
  "autumn", "avocado", "badge", "banana", "beacon", "breeze", "bunker", "cabin",
  "cactus", "canyon", "castle", "cipher", "clever", "cloud", "clover", "cobalt",
  "cosmic", "crypto", "cursor", "danger", "desert", "dragon", "dynamic", "eagle",
  "falcon", "galaxy", "harbor", "island", "jungle", "matrix", "meteor", "nebula",
  "orange", "oxygen", "planet", "proton", "quantum", "rocket", "safari", "shadow",
  "silver", "solar", "spirit", "stream", "summit", "timber", "titan", "vector",
  "vortex", "voyage", "walnut", "wizard", "zenith", "zephyr"
];

const AMBIGUOUS = "il1Lo0O";

export function GeneratorPage() {
  const { openAddItem } = useUIStore();
  const [mode, setMode] = useState<'random' | 'passphrase' | 'pin' | 'pronounceable'>('random');

  // Random options
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);

  // Passphrase options
  const [wordCount, setWordCount] = useState(5);
  const [separator, setSeparator] = useState('-');
  const [capitalize, setCapitalize] = useState(true);

  // Generated state
  const [password, setPassword] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [entropy, setEntropy] = useState(0);

  const generate = () => {
    let result = '';
    let poolSize = 0;

    if (mode === 'random') {
      let pool = '';
      if (uppercase) pool += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (lowercase) pool += 'abcdefghijklmnopqrstuvwxyz';
      if (digits) pool += '0123456789';
      if (symbols) pool += '!@#$%^&*()-_=+[]{}|;:,.<>?';

      if (excludeAmbiguous) {
        pool = pool.split('').filter((c) => !AMBIGUOUS.includes(c)).join('');
      }

      if (!pool) pool = 'abcdefghijklmnopqrstuvwxyz0123456789';
      poolSize = pool.length;

      const randomBytes = new Uint32Array(length);
      window.crypto.getRandomValues(randomBytes);
      for (let i = 0; i < length; i++) {
        result += pool[randomBytes[i] % pool.length];
      }
    } else if (mode === 'passphrase') {
      poolSize = WORDS.length;
      const randomBytes = new Uint32Array(wordCount);
      window.crypto.getRandomValues(randomBytes);
      const chosenWords = [];
      for (let i = 0; i < wordCount; i++) {
        let w = WORDS[randomBytes[i] % WORDS.length];
        if (capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
        chosenWords.push(w);
      }
      result = chosenWords.join(separator);
    } else if (mode === 'pin') {
      poolSize = 10;
      const digitsList = '0123456789';
      const randomBytes = new Uint32Array(length);
      window.crypto.getRandomValues(randomBytes);
      for (let i = 0; i < length; i++) {
        result += digitsList[randomBytes[i] % 10];
      }
    } else if (mode === 'pronounceable') {
      poolSize = 26;
      const v = 'aeiou';
      const c = 'bcdfghjklmnpqrstvwxyz';
      const randomBytes = new Uint32Array(length);
      window.crypto.getRandomValues(randomBytes);
      for (let i = 0; i < length; i++) {
        const pool = i % 2 === 0 ? c : v;
        result += pool[randomBytes[i] % pool.length];
      }
    }

    setPassword(result);
    setHistory((prev) => [result, ...prev.slice(0, 19)]);

    // Entropy calculation
    if (mode === 'passphrase') {
      setEntropy(Math.round(wordCount * Math.log2(poolSize)));
    } else {
      setEntropy(Math.round(length * Math.log2(poolSize || 26)));
    }
  };

  useEffect(() => {
    generate();
  }, [mode, length, uppercase, lowercase, digits, symbols, excludeAmbiguous, wordCount, separator, capitalize]);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <KeyRound className="h-6 w-6 text-primary" />
          Password Generator
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Cryptographically secure generation via Web Crypto CSPRNG with entropy analysis.
        </p>
      </div>

      {/* Generated Display Box */}
      <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-background/80">
          <span className="font-mono text-xl sm:text-2xl font-bold tracking-wide text-foreground break-all select-all">
            {password}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="icon" variant="ghost" onClick={generate} title="Regenerate">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <CopyButton text={password} size="icon" variant="ghost" />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Entropy: <strong className="text-foreground">{entropy} bits</strong></span>
          <Button
            size="sm"
            onClick={() => openAddItem('login')}
            className="h-8 gap-1.5 font-semibold text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Save to Vault
          </Button>
        </div>

        <PasswordStrengthMeter password={password} />
      </div>

      {/* Settings Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-6">
          <Tabs value={mode} onValueChange={(v: any) => setMode(v)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="random">Random</TabsTrigger>
              <TabsTrigger value="passphrase">Passphrase</TabsTrigger>
              <TabsTrigger value="pin">PIN</TabsTrigger>
              <TabsTrigger value="pronounceable">Pronounceable</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'random' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Length: {length}</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={128}
                  value={length}
                  onChange={(e) => setLength(parseInt(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Uppercase (A-Z)</span>
                  <Switch checked={uppercase} onCheckedChange={setUppercase} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Lowercase (a-z)</span>
                  <Switch checked={lowercase} onCheckedChange={setLowercase} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Numbers (0-9)</span>
                  <Switch checked={digits} onCheckedChange={setDigits} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Symbols (!@#$)</span>
                  <Switch checked={symbols} onCheckedChange={setSymbols} />
                </label>
                <label className="flex items-center justify-between cursor-pointer col-span-2">
                  <span>Exclude Ambiguous ({AMBIGUOUS})</span>
                  <Switch checked={excludeAmbiguous} onCheckedChange={setExcludeAmbiguous} />
                </label>
              </div>
            </div>
          )}

          {mode === 'passphrase' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Word Count: {wordCount}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={wordCount}
                  onChange={(e) => setWordCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div>
                  <span className="block mb-1.5 font-semibold">Separator</span>
                  <Input
                    value={separator}
                    onChange={(e) => setSeparator(e.target.value)}
                    maxLength={3}
                    className="h-8 text-xs font-mono w-24"
                  />
                </div>
                <label className="flex items-center justify-between cursor-pointer self-end pb-1">
                  <span>Capitalize Words</span>
                  <Switch checked={capitalize} onCheckedChange={setCapitalize} />
                </label>
              </div>
            </div>
          )}

          {mode === 'pin' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>PIN Length: {length}</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={16}
                  value={length}
                  onChange={(e) => setLength(parseInt(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          )}

          {mode === 'pronounceable' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Length: {length}</span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={32}
                  value={length}
                  onChange={(e) => setLength(parseInt(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* In-Memory Session History */}
        <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md flex flex-col h-[380px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
            <History className="h-3.5 w-3.5" />
            Session History ({history.length})
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Stored in RAM only. Clears upon vault lock or tab refresh.
          </p>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {history.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg border bg-background/50 hover:bg-background text-xs font-mono transition-colors"
              >
                <span className="truncate max-w-[160px]">{item}</span>
                <CopyButton text={item} size="icon" variant="ghost" className="h-6 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
