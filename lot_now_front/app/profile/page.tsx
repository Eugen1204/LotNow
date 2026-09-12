'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Gavel,
  Loader2,
  Pencil,
  X,
  Camera,
  ArrowRight,
  Inbox,
  MoreVertical,
  Send,
} from 'lucide-react';
import { ProtectedRoute } from '@/src/features/auth/ProtectedRoute';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useUpdateMe, useLots, useMyBids, usePublishLot } from '@/src/features/lots/lotsQueries';
import { lotsApi } from '@/src/shared/api/endpoints';
import { ApiErrorImpl } from '@/src/shared/api/client';
import { validateImageFile, readFileAsDataUrl } from '@/src/shared/lib/file';
import {
  initialsFrom,
  formatPrice,
  formatRelativeTime,
} from '@/src/shared/lib/format';
import { PageShell } from '@/src/shared/components/PageShell';
import { LoadingScreen } from '@/src/shared/components/LoadingScreen';
import { EmptyState } from '@/src/shared/components/EmptyState';
import { StatusBadge } from '@/src/shared/components/StatusBadge';
import { LotImage } from '@/src/shared/components/LotImage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Lot, Bid, LotStatus } from '@/src/shared/types/api';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

type LotTab = 'all' | 'active' | 'draft' | 'finished';

const TAB_FILTERS: Record<LotTab, (l: Lot) => boolean> = {
  all: () => true,
  active: (l) => l.status === 'ACTIVE',
  draft: (l) => l.status === 'DRAFT',
  finished: (l) => l.status === 'SOLD' || l.status === 'UNSOLD' || l.status === 'CANCELLED',
};

const TAB_LABELS: Record<LotTab, string> = {
  all: 'Все',
  active: 'Активные',
  draft: 'Черновики',
  finished: 'Завершённые',
};

function ProfileContent() {
  const { user, refetchUser } = useAuth();

  if (!user) return <LoadingScreen />;

  return (
    <PageShell className="py-0 sm:py-0">
      <div className="mx-auto w-full max-w-3xl">
        <HeroProfile user={user} onUpdated={refetchUser} />
        <MyLotsSection userId={user.id} />
        <MyBidsSection />
      </div>
    </PageShell>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────

function HeroProfile({
  user,
  onUpdated,
}: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onUpdated: () => Promise<unknown>;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden rounded-b-2xl bg-gradient-to-b from-muted/60 to-background">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.02]" />
        <div className="relative flex flex-col items-center px-6 pb-10 pt-12 text-center sm:pt-16">
          <button
            onClick={() => setModalOpen(true)}
            className="group relative mb-5 shrink-0"
            aria-label="Сменить аватар"
          >
            <AvatarLarge
              username={user.username}
              avatarUrl={user.avatar_url ?? null}
              size={100}
              ring
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </span>
          </button>

          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            {user.username}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          <p
            className={cn(
              'mt-3 max-w-md text-[16px] leading-relaxed',
              user.bio
                ? 'text-foreground/80'
                : 'italic text-muted-foreground/60',
            )}
          >
            {user.bio || 'Расскажите о себе…'}
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
        >
          <Pencil className="h-3.5 w-3.5" />
          Редактировать
        </button>
      </section>

      <EditProfileModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={user}
        onUpdated={onUpdated}
      />
    </>
  );
}

function AvatarLarge({
  username,
  avatarUrl,
  size = 100,
  ring = false,
}: {
  username: string;
  avatarUrl: string | null;
  size?: number;
  ring?: boolean;
}) {
  const dim = { width: size, height: size };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        style={dim}
        className={cn(
          'shrink-0 rounded-full border-2 object-cover',
          ring ? 'border-white shadow-md dark:border-background' : 'border-border',
        )}
      />
    );
  }
  return (
    <div
      style={dim}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground',
        ring ? 'border-white shadow-md dark:border-background' : 'border-border',
      )}
    >
      {initialsFrom(username)}
    </div>
  );
}

// ─── Edit Modal ─────────────────────────────────────────────────────────

function EditProfileModal({
  open,
  onOpenChange,
  user,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onUpdated: () => Promise<unknown>;
}) {
  const updateMe = useUpdateMe();
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(
    user.avatar_url ?? null,
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatar_url ?? null,
  );
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setBio(user.bio ?? '');
      setAvatarBase64(user.avatar_url ?? null);
      setAvatarPreview(user.avatar_url ?? null);
      setAvatarError(null);
    }
  }, [open, user.bio, user.avatar_url]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setAvatarError(validation.error ?? 'Недопустимый файл');
      return;
    }
    setAvatarError(null);
    setConverting(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      const base64 = await readFileAsDataUrl(file);
      setAvatarBase64(base64);
    } catch {
      setAvatarError('Не удалось обработать файл');
    } finally {
      setConverting(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateMe.mutateAsync({
        bio: bio || null,
        avatar_url: avatarBase64,
      });
      await onUpdated();
      toast.success('Профиль обновлён');
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiErrorImpl ? err.message : 'Не удалось обновить профиль';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg">Редактировать профиль</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6 pt-2">
          {/* Avatar picker */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative"
              aria-label="Загрузить аватар"
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Аватар"
                  className="h-24 w-24 rounded-full border-2 border-border object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border bg-muted text-2xl font-bold text-muted-foreground">
                  {initialsFrom(user.username)}
                </div>
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {converting ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={handleFileChange}
            />
            {avatarError && (
              <p className="text-xs text-destructive">{avatarError}</p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label htmlFor="bio" className="text-sm font-medium text-foreground">
              О себе
            </label>
            <Textarea
              id="bio"
              rows={3}
              maxLength={500}
              placeholder="Расскажите о себе…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {bio.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={updateMe.isPending}
            >
              <X className="mr-1.5 h-4 w-4" />
              Отмена
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMe.isPending || converting}>
              {(updateMe.isPending || converting) && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── My Lots ────────────────────────────────────────────────────────────

function MyLotsSection({ userId }: { userId: number }) {
  const { data: allLots, isLoading: allLoading, isError: allError } = useLots();
  const draftsQuery = useLots('draft');
  const publishLot = usePublishLot();
  const [tab, setTab] = useState<LotTab>('all');

  const myLots = useMemo(() => {
    const all = allLots ?? [];
    const drafts = draftsQuery.data ?? [];

    // Debug: log raw data from both sources
    console.log('[MyLots] raw allLots:', all.length, all.map((l: Lot) => ({ id: l.id, creator_id: l.creator_id, status: l.status })));
    console.log('[MyLots] raw drafts:', drafts.length, drafts.map((l: Lot) => ({ id: l.id, creator_id: l.creator_id, status: l.status })));
    console.log('[MyLots] currentUserId:', userId, typeof userId);

    const merged = new Map<number, Lot>();
    // From GET /lots/ — all lots except other users' drafts
    for (const l of all) {
      if (Number(l.creator_id) === Number(userId)) {
        merged.set(l.id, l);
      }
    }
    // From GET /lots/?status_filter=draft — the user's own drafts
    for (const l of drafts) {
      if (Number(l.creator_id) === Number(userId)) {
        merged.set(l.id, l);
      }
    }

    console.log('[MyLots] merged unique lots:', merged.size, Array.from(merged.values()).map(l => ({ id: l.id, status: l.status })));

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [allLots, draftsQuery.data, userId]);

  const handlePublish = async (lot: Lot) => {
    try {
      await publishLot.mutateAsync(lot.id);
      toast.success('Лот опубликован');
    } catch (err) {
      const msg =
        err instanceof ApiErrorImpl ? err.message : 'Не удалось опубликовать лот';
      toast.error(msg);
    }
  };

  const filtered = useMemo(
    () => myLots.filter((l) => {
      const status = String(l.status).toUpperCase();
      switch (tab) {
        case 'all': return true;
        case 'active': return status === 'ACTIVE';
        case 'draft': return status === 'DRAFT';
        case 'finished': return status === 'SOLD' || status === 'UNSOLD' || status === 'CANCELLED';
        default: return true;
      }
    }),
    [myLots, tab],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<LotTab, number> = { all: 0, active: 0, draft: 0, finished: 0 };
    for (const l of myLots) {
      const status = String(l.status).toUpperCase();
      counts.all++;
      if (status === 'ACTIVE') counts.active++;
      else if (status === 'DRAFT') counts.draft++;
      else counts.finished++;
    }
    return counts;
  }, [myLots]);

  const tabs: LotTab[] = ['all', 'active', 'draft', 'finished'];

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">Мои лоты</h2>
        <span className="text-sm text-muted-foreground">({myLots.length})</span>
        <div className="ml-auto h-px flex-1 bg-border" />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {TAB_LABELS[t]} ({tabCounts[t]})
            {tab === t && (
              <motion.div
                layoutId="lot-tab-indicator"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
              />
            )}
          </button>
        ))}
      </div>

      {allLoading ? (
        <LoadingScreen label="Загрузка лотов…" />
      ) : allError ? (
        <EmptyState title="Не удалось загрузить лоты" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            myLots.length === 0
              ? 'У вас пока нет лотов'
              : 'В этой категории нет лотов'
          }
          description={
            myLots.length === 0
              ? 'Создайте первый лот, чтобы начать торговать'
              : undefined
          }
          action={
            myLots.length === 0 ? (
              <Button asChild size="sm">
                <Link href="/lots/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Создать лот
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((lot, i) => (
              <motion.div
                key={lot.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.15) }}
              >
                <Card className="group flex items-center gap-4 p-3 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <Link href={`/lots/${lot.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-lg">
                      <LotImage
                        src={lot.image_url ?? null}
                        alt={lot.title}
                        aspect="card"
                        className="h-[60px] w-[60px] rounded-lg"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
                        {lot.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatPrice(lot.current_price)}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={lot.status} />
                    {String(lot.status).toUpperCase() === 'DRAFT' ? (
                      <DraftActions
                        lot={lot}
                        publishing={publishLot.isPending}
                        onPublish={handlePublish}
                      />
                    ) : (
                      <Link href={`/lots/${lot.id}`} aria-label="Открыть лот">
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

// ─── Draft Actions (inline on profile cards) ──────────────────────────

function DraftActions({
  lot,
  publishing,
  onPublish,
}: {
  lot: Lot;
  publishing: boolean;
  onPublish: (lot: Lot) => Promise<void>;
}) {
  // Debug: log the raw status to verify casing from backend
  console.log('[DraftActions] lot.status =', lot.status, '(type:', typeof lot.status, ')');

  const canPublish = Boolean(lot.start_time) && Boolean(lot.end_time);

  return (
    <div className="flex items-center gap-1">
      <Button asChild size="sm" variant="ghost" className="h-8 px-2">
        <Link href={`/lots/${lot.id}/edit`} aria-label="Редактировать">
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </Button>
      {canPublish ? (
        <Button
          size="sm"
          variant="default"
          className="h-8 gap-1 px-2"
          disabled={publishing}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPublish(lot);
          }}
        >
          {publishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Опубликовать
        </Button>
      ) : (
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs text-muted-foreground"
          title="Укажите даты торгов чтобы опубликовать"
        >
          <Link href={`/lots/${lot.id}/edit`}>Нет дат</Link>
        </Button>
      )}
    </div>
  );
}

// ─── My Bids ───────────────────────────────────────────────────────────

function MyBidsSection() {
  const { data: bids, isLoading, isError } = useMyBids();

  const sorted = useMemo(() => {
    if (!bids) return [];
    return [...bids].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [bids]);

  // Enrich missing lot titles
  const [enriched, setEnriched] = useState<Bid[]>(sorted);
  useEffect(() => {
    setEnriched(sorted);
    const missing = sorted.filter((b) => !b.lot);
    if (missing.length === 0) return;
    let active = true;
    Promise.all(
      missing.map(async (b) => {
        try {
          const lot = await lotsApi.detail(b.lot_id);
          return {
            ...b,
            lot: { id: lot.id, title: lot.title, status: lot.status },
          };
        } catch {
          return b;
        }
      }),
    ).then((updated) => {
      if (!active) return;
      const map = new Map(updated.map((u) => [u.id, u]));
      setEnriched((prev) => prev.map((b) => map.get(b.id) ?? b));
    });
    return () => {
      active = false;
    };
  }, [sorted]);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">Мои ставки</h2>
        <span className="text-sm text-muted-foreground">({sorted.length})</span>
        <div className="ml-auto h-px flex-1 bg-border" />
      </div>

      {isLoading ? (
        <LoadingScreen label="Загрузка ставок…" />
      ) : isError ? (
        <EmptyState title="Не удалось загрузить ставки" />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Вы ещё не делали ставок"
          description="Перейдите к списку лотов и сделайте первую ставку"
          action={
            <Button asChild size="sm">
              <Link href="/lots">
                <Gavel className="mr-1.5 h-4 w-4" />
                К лотам
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {enriched.map((bid, i) => (
            <motion.div
              key={bid.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.15) }}
            >
              <Link href={`/lots/${bid.lot_id}`} className="block">
                <Card className="group flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
                      {bid.lot?.title ?? `Лот #${bid.lot_id}`}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeTime(bid.created_at)}
                    </p>
                  </div>
                  {bid.lot?.status && (
                    <StatusBadge status={bid.lot.status as LotStatus} />
                  )}
                  <div className="shrink-0 text-right">
                    <span className="text-lg font-bold tabular-nums text-primary">
                      {formatPrice(bid.amount)}
                    </span>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
