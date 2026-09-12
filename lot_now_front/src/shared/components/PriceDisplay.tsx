'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/src/shared/lib/format';
import { AnimatePresence, motion } from 'framer-motion';

export function PriceDisplay({
  value,
  className,
  size = 'lg',
}: {
  value: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const prev = useRef(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value > prev.current) setDir('up');
    else if (value < prev.current) setDir('down');
    prev.current = value;
    if (dir) {
      const t = setTimeout(() => setDir(null), 600);
      return () => clearTimeout(t);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const sizes: Record<string, string> = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl sm:text-5xl',
  };

  return (
    <span className="relative inline-flex items-baseline">
      <motion.span
        key={value}
        initial={dir ? { y: dir === 'up' ? 6 : -6, opacity: 0.4 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={cn(
          'font-semibold tabular-nums tracking-tight',
          sizes[size],
          dir === 'up' && 'text-success',
          dir === 'down' && 'text-destructive',
          className,
        )}
      >
        {formatPrice(value)}
      </motion.span>
    </span>
  );
}
