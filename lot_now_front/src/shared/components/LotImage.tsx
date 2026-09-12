'use client';

import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LotImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspect?: 'card' | 'detail';
}

export function LotImage({ src, alt, className, aspect = 'card' }: LotImageProps) {
  const aspectClass = aspect === 'detail' ? 'aspect-[16/9]' : 'aspect-[4/3]';

  if (!src) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center rounded-lg border border-border bg-muted/40',
          aspectClass,
          className,
        )}
        aria-label={`Нет изображения: ${alt}`}
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground/50" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn('w-full rounded-lg border border-border object-cover', aspectClass, className)}
    />
  );
}
