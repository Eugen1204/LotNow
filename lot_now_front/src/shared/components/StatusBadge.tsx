import { cn } from '@/lib/utils';
import type { LotStatus } from '@/src/shared/types/api';

const STATUS_STYLES: Record<LotStatus, string> = {
  ACTIVE: 'bg-success/10 text-success border-success/20',
  DRAFT: 'bg-muted text-muted-foreground border-border',
  SOLD: 'bg-muted text-muted-foreground border-border',
  UNSOLD: 'bg-warning/10 text-warning border-warning/30',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABEL: Record<LotStatus, string> = {
  ACTIVE: 'Активен',
  DRAFT: 'Черновик',
  SOLD: 'Продан',
  UNSOLD: 'Не продан',
  CANCELLED: 'Отменён',
};

export function StatusBadge({
  status,
  className,
}: {
  status: LotStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight',
        STATUS_STYLES[status],
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
