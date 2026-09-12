'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEN_MINUTES_MS = 10 * 60 * 1000;

function formatHMS(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function CountdownTimer({
  endIso,
  className,
  onExpire,
}: {
  endIso: string | null | undefined;
  className?: string;
  onExpire?: () => void;
}) {
  const endMs = endIso ? new Date(endIso).getTime() : 0;
  const [remaining, setRemaining] = useState(() => endMs - Date.now());
  const [expired, setExpired] = useState(() => endMs - Date.now() <= 0);

  useEffect(() => {
    const tick = () => {
      const r = endMs - Date.now();
      setRemaining(r);
      if (r <= 0) {
        setExpired(true);
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endMs, onExpire]);

  const isUrgent = !expired && remaining > 0 && remaining <= TEN_MINUTES_MS;

  if (expired) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground',
          className,
        )}
      >
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Торги завершены
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-sm tabular-nums',
        isUrgent ? 'text-warning' : 'text-foreground',
        className,
      )}
      aria-label={`Осталось ${formatHMS(remaining)}`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {formatHMS(remaining)}
    </span>
  );
}
