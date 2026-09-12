'use client';

import { useMemo, useState } from 'react';
import { useLots } from '@/src/features/lots/lotsQueries';
import { LotCard } from '@/src/features/lots/LotCard';
import { PageShell, PageHeader } from '@/src/shared/components/PageShell';
import { LoadingScreen } from '@/src/shared/components/LoadingScreen';
import { EmptyState, ErrorState } from '@/src/shared/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { Lot, LotStatus } from '@/src/shared/types/api';

const STATUS_ORDER: LotStatus[] = [
  'ACTIVE',
  'SOLD',
  'UNSOLD',
  'CANCELLED',
];

const STATUS_LABELS: Record<LotStatus, string> = {
  ACTIVE: 'Активен',
  DRAFT: 'Черновик',
  SOLD: 'Продан',
  UNSOLD: 'Не продан',
  CANCELLED: 'Отменён',
};

type Filter = 'ALL' | 'MY_DRAFTS' | LotStatus;
type SortKey = 'STATUS' | 'PRICE_ASC' | 'PRICE_DESC' | 'END_SOONEST';

export default function LotsPage() {
  const [statusFilter, setStatusFilter] = useState<Filter>('ALL');
  const { data, isLoading, isError, refetch, isFetching } =
    useLots(statusFilter === 'MY_DRAFTS' ? 'draft' : undefined);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('STATUS');

  const filtered = useMemo(() => {
    if (!data) return [];
    let list: Lot[] = data;

    // For MY_DRAFTS the API already returns only the user's drafts,
    // so no extra client-side status filter is needed.
    if (statusFilter !== 'ALL' && statusFilter !== 'MY_DRAFTS') {
      list = list.filter((l) => l.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case 'PRICE_ASC':
        sorted.sort((a, b) => a.current_price - b.current_price);
        break;
      case 'PRICE_DESC':
        sorted.sort((a, b) => b.current_price - a.current_price);
        break;
      case 'END_SOONEST':
        sorted.sort(
          (a, b) =>
            new Date(a.end_time ?? 0).getTime() -
            new Date(b.end_time ?? 0).getTime(),
        );
        break;
      case 'STATUS':
      default:
        sorted.sort(
          (a, b) =>
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
        );
    }
    return sorted;
  }, [data, query, statusFilter, sort]);

  return (
    <PageShell>
      <PageHeader
        title="Лоты"
        description="Активные и завершённые аукционы в реальном времени"
        actions={
          <Button asChild>
            <Link href="/lots/new">
              <Plus className="mr-1.5 h-4 w-4" /> Создать лот
            </Link>
          </Button>
        }
      />

      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию или описанию"
            className="pl-9"
            aria-label="Поиск лотов"
          />
        </div>
        <div className="flex gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as Filter)}
          >
            <SelectTrigger className="w-full sm:w-[170px]" aria-label="Фильтр по статусу">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все статусы</SelectItem>
              <SelectItem value="MY_DRAFTS">Мои черновики</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Сортировка">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STATUS">По статусу</SelectItem>
              <SelectItem value="PRICE_DESC">Цена: по убыванию</SelectItem>
              <SelectItem value="PRICE_ASC">Цена: по возрастанию</SelectItem>
              <SelectItem value="END_SOONEST">Скоро завершатся</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* State */}
      {isLoading ? (
        <LoadingScreen label="Загрузка лотов…" />
      ) : isError ? (
        <ErrorState
          title="Не удалось загрузить лоты"
          description="Проверьте подключение к серверу и попробуйте снова"
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Лоты не найдены"
          description={
            query || statusFilter !== 'ALL'
              ? 'Попробуйте изменить параметры поиска или фильтра'
              : 'Создайте первый лот, чтобы начать торги'
          }
          action={
            <Button asChild>
              <Link href="/lots/new">
                <Plus className="mr-1.5 h-4 w-4" /> Создать лот
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lot, i) => (
            <LotCard key={lot.id} lot={lot} index={i} />
          ))}
        </div>
      )}

      {isFetching && !isLoading && (
        <div className="mt-4 flex items-center justify-center text-xs text-muted-foreground">
          <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />
          Обновление…
        </div>
      )}
    </PageShell>
  );
}
