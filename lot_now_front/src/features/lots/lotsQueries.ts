import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lotsApi, bidsApi, authApi } from '@/src/shared/api/endpoints';
import type { CreateLotPayload, UpdateLotPayload, Lot, LotDetail, LotStatus, Bid, User, UpdateUserPayload } from '@/src/shared/types/api';

export const lotsKeys = {
  all: ['lots'] as const,
  list: () => [...lotsKeys.all, 'list'] as const,
  detail: (id: number | string) => [...lotsKeys.all, 'detail', id] as const,
};

// Backend may return status in any casing (e.g. 'active', 'ACTIVE').
// Normalise to uppercase so all comparisons in the UI use a single form.
function normalizeStatus(raw: string): LotStatus {
  return raw.toUpperCase() as LotStatus;
}

function normalizeLot<T extends Lot>(lot: T): T {
  const raw = lot as unknown as Record<string, unknown>;
  const owner_id = Number(raw.owner_id);
  // Backend may return creator_id or owner_id (or both). Fall back to owner_id
  // so ownership checks in the profile work regardless of which field the API
  // serializes.
  const creator_id = Number(raw.creator_id ?? raw.owner_id);
  return {
    ...lot,
    start_price: Number(lot.start_price),
    current_price: Number(lot.current_price),
    min_step: Number(lot.min_step),
    owner_id,
    creator_id,
    status: normalizeStatus(lot.status as unknown as string),
  };
}

export function useLots(statusFilter?: string) {
  return useQuery<Lot[]>({
    queryKey: [...lotsKeys.list(), statusFilter ?? 'all'],
    queryFn: async () => {
      const raw = await lotsApi.list(
        statusFilter ? { status_filter: statusFilter } : undefined,
      );
      // Debug: log the first raw lot exactly as received from the server,
      // before any client-side normalization, to confirm creator_id presence.
      if (raw.length > 0) {
        const first = raw[0] as unknown as Record<string, unknown>;
        console.log('[useLots] raw first lot (pre-normalize):', JSON.stringify(first));
        console.log('[useLots] raw first lot creator_id:', first.creator_id, 'owner_id:', first.owner_id);
      }
      return raw.map(normalizeLot);
    },
    staleTime: 15_000,
  });
}

export function useLot(id: number | string | null) {
  return useQuery<LotDetail>({
    queryKey: lotsKeys.detail(id ?? 0),
    queryFn: async () => normalizeLot(await lotsApi.detail(id as number)),
    enabled: id != null,
    staleTime: 5_000,
  });
}

export function useCreateLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLotPayload) =>  {
     return lotsApi.create(payload);
     },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lotsKeys.list() });
    },
  });
}

export function usePublishLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => lotsApi.publish(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: lotsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: lotsKeys.list() });
    },
  });
}

export function useUpdateLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: UpdateLotPayload }) =>
      lotsApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: lotsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: lotsKeys.list() });
    },
  });
}

export const bidsKeys = {
  all: ['bids'] as const,
  my: () => [...bidsKeys.all, 'my'] as const,
};

export function useMyBids(enabled = true) {
  return useQuery<Bid[]>({
    queryKey: bidsKeys.my(),
    queryFn: async () => {
      try {
        const bids = await bidsApi.myBids();
        console.log('[useMyBids] loaded', bids.length, 'bids');
        return bids;
      } catch (err) {
        console.error('[useMyBids] failed to load bids:', err);
        throw err;
      }
    },
    enabled,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation<User, Error, UpdateUserPayload>({
    mutationFn: (payload) => authApi.updateMe(payload),
    onSuccess: (data) => {
      qc.setQueryData<User>(userKeys.me, data);
    },
  });
}

export const userKeys = {
  me: ['user', 'me'] as const,
};
