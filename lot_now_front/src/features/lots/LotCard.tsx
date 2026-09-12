'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/src/shared/components/StatusBadge';
import { CountdownTimer } from '@/src/shared/components/CountdownTimer';
import { PriceDisplay } from '@/src/shared/components/PriceDisplay';
import { LotImage } from '@/src/shared/components/LotImage';
import type { Lot } from '@/src/shared/types/api';

export function LotCard({ lot, index = 0 }: { lot: Lot; index?: number }) {
  const isDraft = lot.status === 'DRAFT';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.2), ease: 'easeOut' }}
    >
      <Card
        className={`group relative flex h-full flex-col gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
          isDraft
            ? 'border-muted bg-muted/30 hover:border-muted-foreground/30'
            : 'hover:border-primary/40'
        }`}
      >
        {isDraft && (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-muted-foreground/15 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            Черновик
          </span>
        )}

        <LotImage src={lot.image_url ?? null} alt={lot.title} aspect="card" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
              {lot.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {lot.description}
            </p>
          </div>
          {!isDraft && <StatusBadge status={lot.status} />}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Текущая цена
            </span>
            <PriceDisplay value={lot.current_price} size="md" />
          </div>

          <div className="flex items-center justify-between">
            {isDraft ? (
              <span className="text-xs text-muted-foreground">Не опубликован</span>
           ) : (
              <CountdownTimer endIso={lot.end_time} />
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary"
            >
              <Link href={`/lots/${lot.id}`}>
                Открыть
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
