'use client';

import { ProtectedRoute } from '@/src/features/auth/ProtectedRoute';
import { useMyBids } from '@/src/features/lots/lotsQueries';
import { PageShell, PageHeader } from '@/src/shared/components/PageShell';
import { LoadingScreen } from '@/src/shared/components/LoadingScreen';
import { EmptyState, ErrorState } from '@/src/shared/components/EmptyState';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { Gavel } from 'lucide-react';
import { formatPrice, formatDateTime } from '@/src/shared/lib/format';
import type { Bid } from '@/src/shared/types/api';

export default function MyBidsPage() {
  return (
    <ProtectedRoute>
      <MyBidsContent />
    </ProtectedRoute>
  );
}

function MyBidsContent() {
  const { data: bids, isLoading, isError, refetch } = useMyBids();

  return (
    <PageShell>
      <PageHeader
        title="Мои ставки"
        description="История ваших ставок на аукционах"
      />

      {isLoading ? (
        <LoadingScreen label="Загрузка ставок…" />
      ) : isError ? (
        <ErrorState
          title="Не удалось загрузить ставки"
          onRetry={() => refetch()}
        />
      ) : !bids || bids.length === 0 ? (
        <EmptyState
          title="Ставок пока нет"
          description="Перейдите к списку лотов и сделайте первую ставку"
          action={
            <Link
              href="/lots"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Gavel className="h-4 w-4" /> К лотам
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Лот</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Время</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bids.map((bid: Bid) => (
                <TableRow key={bid.id}>
                  <TableCell className="font-medium">
                    {bid.lot ? (
                      <Link
                        href={`/lots/${bid.lot_id}`}
                        className="text-primary hover:underline"
                      >
                        {bid.lot.title}
                      </Link>
                    ) : (
                      <>Лот #{bid.lot_id}</>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatPrice(bid.amount)}
                  </TableCell>
                  <TableCell>
                    {bid.lot?.status ? (
                      <Badge variant="secondary">{bid.lot.status}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDateTime(bid.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </PageShell>
  );
}
