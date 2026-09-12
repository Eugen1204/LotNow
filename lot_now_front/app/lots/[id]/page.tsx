'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Clock,
  UserCircle,
  Loader2,
  EyeOff,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/src/features/auth/ProtectedRoute';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useLot, lotsKeys, usePublishLot } from '@/src/features/lots/lotsQueries';
import { lotsApi, bidsApi } from '@/src/shared/api/endpoints';
import {
  useAuctionSocket,
  type SocketStatus,
} from '@/src/features/websocket/useAuctionSocket';
import {
  EventFeed,
  type AuctionEvent,
} from '@/src/features/bids/EventFeed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { PageShell } from '@/src/shared/components/PageShell';
import { LoadingScreen } from '@/src/shared/components/LoadingScreen';
import { ErrorState } from '@/src/shared/components/EmptyState';
import { StatusBadge } from '@/src/shared/components/StatusBadge';
import { CountdownTimer } from '@/src/shared/components/CountdownTimer';
import { PriceDisplay } from '@/src/shared/components/PriceDisplay';
import { LotImage } from '@/src/shared/components/LotImage';
import { formatPrice, formatDateTime } from '@/src/shared/lib/format';
import type { WsInboundMessage, LotDetail } from '@/src/shared/types/api';

interface LotDetailRouteProps {
  params: { id: string };
}

export default function LotDetailPage({ params }: LotDetailRouteProps) {
  return (
    <ProtectedRoute>
      <LotDetail lotId={params.id} />
    </ProtectedRoute>
  );
}

function LotDetail({ lotId }: { lotId: string }) {
  const router = useRouter();
  const { data: lot, isLoading, isError } = useLot(lotId);
  const [events, setEvents] = useState<AuctionEvent[]>([]);
  const qc = useQueryClient();

  // TODO: заменить на полноценный backend endpoint истории ставок лота когда он будет реализован.
  // Временно: при загрузке страницы подгружаем собственные ставки пользователя на этот лот
  // через GET /users/me/bids и заполняем начальную ленту событий, чтобы она не была пустой.
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let active = true;
    bidsApi
      .myBids()
      .then((bids) => {
        if (!active) return;
        const lotBids = bids
          .filter((b) => Number(b.lot_id) === Number(lotId))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (lotBids.length === 0) return;
        const seedEvents: AuctionEvent[] = lotBids.map((b) => ({
          id: `seed-${b.id}`,
          type: 'bid_placed' as const,
          amount: Number(b.amount),
          message: 'Ваша ставка',
          createdAt: new Date(b.created_at).getTime(),
        }));
        setEvents((prev) => {
          // Avoid duplicating if WS already pushed some of these
          const existingIds = new Set(prev.map((e) => e.id));
          const merged = [...seedEvents.filter((e) => !existingIds.has(e.id)), ...prev];
          return merged.slice(0, 50);
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, lotId]);

  const handleWsMessage = useCallback(
    (msg: WsInboundMessage) => {
      if (msg.type === 'STATE_UPDATE') {
        const newPrice = Number(msg.lot.current_price);
        qc.setQueryData<LotDetail>(
          lotsKeys.detail(lotId),
          (prev: LotDetail | undefined) =>
            prev
              ? {
                  ...prev,
                  current_price: newPrice,
                  current_leader_id:
                    msg.lot.current_leader_id ?? prev.current_leader_id,
                  current_leader_username:
                    msg.lot.current_leader_username ??
                    prev.current_leader_username,
                }
              : prev,
        );
        // Refetch only leader identity — merge selectively so we never
        // overwrite the normalised status (backend returns lowercase,
        // UI expects uppercase) or any other field.
        lotsApi
          .detail(lotId)
          .then((fresh) =>
            qc.setQueryData<LotDetail>(
              lotsKeys.detail(lotId),
              (prev: LotDetail | undefined) =>
                prev
                  ? {
                      ...prev,
                      current_price: Number(fresh.current_price),
                      current_leader_id:
                        fresh.current_leader_id ?? prev.current_leader_id,
                      current_leader_username:
                        fresh.current_leader_username ??
                        prev.current_leader_username,
                    }
                  : prev,
            ),
          )
          .catch(() => {});
        setEvents((prev) =>
          [
            {
              id: `${Date.now()}-price`,
              type: 'price_change' as const,
              amount: newPrice,
              message: 'Цена обновлена',
              createdAt: Date.now(),
            },
            ...prev,
          ].slice(0, 50),
        );
      } else if (msg.type === 'AUCTION_FINISHED') {
        const sold = msg.status === 'sold';
        // Update status in cache — drives isActive/isFinished, hides the form.
        qc.setQueryData<LotDetail>(
          lotsKeys.detail(lotId),
          (prev: LotDetail | undefined) =>
            prev ? { ...prev, status: sold ? 'SOLD' : 'UNSOLD' } : prev,
        );
        qc.invalidateQueries({ queryKey: lotsKeys.list() });
        setEvents((prev) =>
          [
            {
              id: `${Date.now()}-fin`,
              type: 'auction_finished' as const,
              message: sold
                ? 'Торги завершены. Лот продан.'
                : 'Торги завершены без победителя.',
              createdAt: Date.now(),
            },
            ...prev,
          ].slice(0, 50),
        );
      } else if (msg.type === 'BID_ERROR') {
        toast.error(msg.message || 'Ставка отклонена');
        setEvents((prev) =>
          [
            {
              id: `${Date.now()}-err`,
              type: 'error' as const,
              message: msg.message,
              createdAt: Date.now(),
            },
            ...prev,
          ].slice(0, 50),
        );
      }
    },
    [lotId, qc],
  );

  const { status: socketStatus, sendBid } = useAuctionSocket({
    lotId,
    onMessage: handleWsMessage,
  });

  const publishLot = usePublishLot();

  const isAuthor =
    user != null && lot != null && Number(lot.creator_id) === Number(user.id);
  const isDraft = lot?.status === 'DRAFT';

  const handlePublish = async () => {
    if (!lot) return;
    try {
      await publishLot.mutateAsync(lot.id);
      await qc.invalidateQueries({ queryKey: lotsKeys.detail(lotId) });
      qc.invalidateQueries({ queryKey: lotsKeys.list() });
      toast.success('Лот опубликован');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось опубликовать лот';
      toast.error(msg);
    }
  };

  if (isLoading) return <LoadingScreen label="Загрузка лота…" />;
  if (isError)
    return (
      <PageShell>
        <ErrorState
          title="Лот не найден"
          description="Возможно, лот был удалён или ссылка некорректна"
          onRetry={() => router.push('/lots')}
        />
      </PageShell>
    );
  if (!lot) return null;

  const isActive = lot.status === 'ACTIVE';
  const isFinished =
    lot.status === 'SOLD' ||
    lot.status === 'UNSOLD' ||
    lot.status === 'CANCELLED';

  return (
    <PageShell>
      <Link
        href="/lots"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> К списку лотов
      </Link>

      {isAuthor && isDraft && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-warning" aria-hidden />
            <p className="text-sm text-foreground">
              Это черновик — он виден только вам
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/lots/${lot.id}/edit`}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Редактировать черновик
              </Link>
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishLot.isPending}
              size="sm"
            >
              {publishLot.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Опубликовать лот
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={lot.status} />
            <SocketStatusPill status={socketStatus} active={isActive} />
          </div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {lot.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {lot.description}
          </p>
        </div>
      </div>

      {isFinished && (
        <FinishedBanner
          status={lot.status as 'SOLD' | 'UNSOLD' | 'CANCELLED'}
          amount={Number(lot.current_price)}
          leaderName={
            lot.current_leader_username ?? lot.leader?.username ?? null
          }
          leaderId={lot.current_leader_id ?? lot.leader?.id ?? null}
          className="mb-6"
        />
      )}

      <div className="mb-6">
        <LotImage
          src={lot.image_url ?? null}
          alt={lot.title}
          aspect="detail"
          className="max-w-2xl"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Текущая цена"
          icon={<Trophy className="h-4 w-4 text-primary" />}
        >
          <PriceDisplay value={Number(lot.current_price)} size="xl" />
        </MetricCard>
        <MetricCard
          label="До конца торгов"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        >
          {isFinished ? (
            <span className="text-lg font-medium text-muted-foreground">
              Завершено
            </span>
          ) : isDraft ? (
            <span className="text-lg font-medium text-muted-foreground">
              Не опубликован
            </span>
          ) : (
            <CountdownTimer endIso={lot.end_time} className="text-lg" />
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {isDraft
              ? 'Время будет установлено при публикации'
              : `Окончание: ${formatDateTime(lot.end_time)}`}
          </p>
        </MetricCard>
        <MetricCard
          label="Текущий лидер"
          icon={<UserCircle className="h-4 w-4 text-muted-foreground" />}
        >
          {(() => {
            const leaderName =
              lot.current_leader_username ?? lot.leader?.username ?? null;
            const leaderId =
              lot.current_leader_id ?? lot.leader?.id ?? null;
            if (leaderName) {
              return (
                <span className="text-lg font-medium text-foreground">
                  {leaderName}
                </span>
              );
            }
            if (leaderId) {
              return (
                <span className="text-lg font-medium text-muted-foreground">
                  Лидер #{leaderId}
                </span>
              );
            }
            return (
              <span className="text-lg font-medium text-muted-foreground">
                Ставок ещё нет
              </span>
            );
          })()}
          <p className="mt-1 text-xs text-muted-foreground">
            Стартовая: {formatPrice(Number(lot.start_price))}
          </p>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BidForm
          lot={lot}
          socketStatus={socketStatus}
          isActive={isActive}
          onSubmitBid={sendBid}
        />
        <Card className="p-5">
          <EventFeed events={events} />
        </Card>
      </div>
    </PageShell>
  );
}

function MetricCard({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </Card>
  );
}

function SocketStatusPill({
  status,
  active,
}: {
  status: SocketStatus;
  active: boolean;
}) {
  if (!active) return null;
  const map: Record<SocketStatus, { label: string; dot: string; text: string }> =
    {
      idle: {
        label: 'Ожидание',
        dot: 'bg-muted-foreground',
        text: 'text-muted-foreground',
      },
      connecting: {
        label: 'Подключение…',
        dot: 'bg-warning animate-pulse',
        text: 'text-warning',
      },
      open: {
        label: 'В эфире',
        dot: 'bg-success animate-pulse',
        text: 'text-success',
      },
      closed: {
        label: 'Отключено',
        dot: 'bg-muted-foreground',
        text: 'text-muted-foreground',
      },
      error: {
        label: 'Ошибка соединения',
        dot: 'bg-destructive',
        text: 'text-destructive',
      },
      finished: {
        label: 'Торги завершены',
        dot: 'bg-muted-foreground',
        text: 'text-muted-foreground',
      },
    };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

function FinishedBanner({
  status,
  amount,
  leaderName,
  leaderId,
  className,
}: {
  status: 'SOLD' | 'UNSOLD' | 'CANCELLED';
  amount: number;
  leaderName: string | null;
  leaderId: number | null;
  className?: string;
}) {
  if (status === 'CANCELLED') {
    return (
      <div
        className={`rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-6 text-center ${className ?? ''}`}
      >
        <p className="text-lg font-semibold text-destructive">Торги отменены</p>
      </div>
    );
  }
  if (status === 'SOLD') {
    const winnerLabel =
      leaderName ?? (leaderId ? `Лидер #${leaderId}` : null);
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex flex-col items-center justify-center rounded-lg border border-success/30 bg-success/5 px-6 py-8 text-center ${className ?? ''}`}
      >
        <Trophy className="mb-2 h-6 w-6 text-success" aria-hidden />
        <p className="text-sm text-muted-foreground">Лот продан за</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
          {formatPrice(amount)}
        </p>
        {winnerLabel && (
          <p className="mt-2 text-sm text-muted-foreground">
            Победитель:{' '}
            <span className="font-medium text-foreground">{winnerLabel}</span>
          </p>
        )}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-lg border border-warning/30 bg-warning/5 px-6 py-8 text-center ${className ?? ''}`}
    >
      <p className="text-lg font-semibold text-foreground">
        Торги завершены без победителя
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Минимальная ставка не была достигнута
      </p>
    </motion.div>
  );
}

function BidForm({
  lot,
  socketStatus,
  isActive,
  onSubmitBid,
}: {
  lot: LotDetail;
  socketStatus: SocketStatus;
  isActive: boolean;
  onSubmitBid: (amount: number) => boolean;
}) {
  const { user } = useAuth();
  const currentPrice = Number(lot.current_price);
  const minStep = Number(lot.min_step);
  const minBid = currentPrice + minStep;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const leaderName =
    lot.current_leader_username ?? lot.leader?.username ?? null;
  const leaderId = lot.current_leader_id ?? lot.leader?.id ?? null;
  const winnerLabel = leaderName ?? (leaderId ? `Лидер #${leaderId}` : null);

  // Lot is not active — show result block, no form elements rendered at all.
  if (!isActive) {
    const isDraft = lot.status === 'DRAFT';
    return (
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          {isDraft ? 'Статус лота' : 'Результат торгов'}
        </h3>
        {isDraft ? (
          <div className="rounded-md border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Лот ещё не опубликован. Ставки не принимаются.
          </div>
        ) : lot.status === 'SOLD' ? (
          <div className="rounded-md border border-success/30 bg-success/5 px-4 py-6 text-center">
            <Trophy className="mx-auto mb-2 h-5 w-5 text-success" aria-hidden />
            <p className="text-sm text-muted-foreground">Лот продан за</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatPrice(currentPrice)}
            </p>
            {winnerLabel && (
              <p className="mt-2 text-sm text-muted-foreground">
                Победитель:{' '}
                <span className="font-medium text-foreground">
                  {winnerLabel}
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            {lot.status === 'CANCELLED'
              ? 'Торги отменены'
              : 'Торги завершены без победителя'}
          </div>
        )}
      </Card>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Hard guard: never send a bid if the lot is not ACTIVE,
    // even if this handler is somehow called while the form is still mounted.
    if (!isActive) {
      toast.error('Торги уже завершены. Ставки не принимаются.');
      return;
    }

    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      const msg = 'Введите положительное число';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (num < minBid) {
      const msg = `Минимальная ставка: ${formatPrice(minBid)}`;
      setError(msg);
      toast.error(msg);
      return;
    }

    setError(null);
    setSubmitting(true);
    const ok = onSubmitBid(num);
    if (!ok) {
      toast.error('Соединение неактивно. Попробуйте через мгновение.');
    } else {
      toast.success('Ставка отправлена');
      setValue('');
    }
    setSubmitting(false);
  };

  const inputDisabled = socketStatus !== 'open' || !user || submitting;

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Сделать ставку</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Минимальная ставка: {formatPrice(minBid)} ({formatPrice(currentPrice)}{' '}
          + {formatPrice(minStep)})
        </p>
      </div>

      {!user ? (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Войдите, чтобы делать ставки.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="bid-amount">Сумма ставки, ₽</Label>
            <Input
              id="bid-amount"
              type="number"
              min={minBid}
              step={minStep}
              placeholder={String(minBid)}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              inputMode="numeric"
              disabled={inputDisabled}
              aria-invalid={!!error}
              aria-describedby="bid-help"
            />
            <p id="bid-help" className="text-xs text-muted-foreground">
              Шаг ставки: {formatPrice(minStep)}
            </p>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={inputDisabled}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Сделать ставку
          </Button>
          {socketStatus !== 'open' && (
            <p className="text-center text-xs text-warning">
              Восстановление соединения…
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
