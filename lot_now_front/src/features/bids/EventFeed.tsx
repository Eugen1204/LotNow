'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, Trophy, Activity } from 'lucide-react';
import { formatPrice, formatDateTime } from '@/src/shared/lib/format';

export interface AuctionEvent {
  id: string;
  type: 'price_change' | 'auction_finished' | 'bid_placed' | 'info' | 'error';
  message?: string;
  amount?: number;
  createdAt: number;
}

export function EventFeed({ events }: { events: AuctionEvent[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Лента событий</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {events.length}
        </span>
      </div>

      <div className="scrollbar-thin max-h-[420px] flex-1 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            Пока нет событий. Подключение к торгам активно.
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {events.map((ev) => (
                <motion.li
                  key={ev.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <EventIcon type={ev.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">
                      {ev.amount !== undefined && (
                        <span className="font-semibold tabular-nums text-success">
                          {formatPrice(ev.amount)}
                        </span>
                      )}
                      {ev.amount !== undefined && ev.message ? ' — ' : ''}
                      {ev.message && (
                        <span className="text-muted-foreground">{ev.message}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(new Date(ev.createdAt).toISOString())}
                    </p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function EventIcon({ type }: { type: AuctionEvent['type'] }) {
  const map = {
    price_change: { icon: TrendingUp, className: 'text-success' },
    bid_placed: { icon: TrendingUp, className: 'text-success' },
    auction_finished: { icon: Trophy, className: 'text-warning' },
    info: { icon: Activity, className: 'text-muted-foreground' },
    error: { icon: AlertTriangle, className: 'text-destructive' },
  } as const;
  const { icon: Icon, className } = map[type];
  return (
    <span className={`mt-0.5 flex h-5 w-5 items-center justify-center ${className}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}
