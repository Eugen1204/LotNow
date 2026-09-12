'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';
import { ProtectedRoute } from '@/src/features/auth/ProtectedRoute';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useLot, useUpdateLot } from '@/src/features/lots/lotsQueries';
import { ApiErrorImpl } from '@/src/shared/api/client';
import { validateImageFile, readFileAsDataUrl } from '@/src/shared/lib/file';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/src/shared/components/PageShell';
import { LoadingScreen } from '@/src/shared/components/LoadingScreen';
import { ErrorState } from '@/src/shared/components/EmptyState';
import type { UpdateLotPayload, LotDetail } from '@/src/shared/types/api';

function toLocalDatetimeInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditLotPage() {
  return (
    <ProtectedRoute>
      <EditLotForm />
    </ProtectedRoute>
  );
}

function EditLotForm() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { data: lot, isLoading, isError, refetch } = useLot(id);
  const updateLot = useUpdateLot();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [minStep, setMinStep] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const isAuthor = user != null && lot?.creator_id === user.id;
  const isDraft = lot?.status === 'DRAFT';

  // Prefill form once lot loads.
  useEffect(() => {
    if (!lot) return;
    setTitle(lot.title ?? '');
    setDescription(lot.description ?? '');
    setStartPrice(String(lot.start_price ?? ''));
    setMinStep(String(lot.min_step ?? ''));
    setStartTime(toLocalDatetimeInputValue(lot.start_time));
    setEndTime(toLocalDatetimeInputValue(lot.end_time));
    setImageBase64(lot.image_url ?? null);
    setImagePreview(lot.image_url ?? null);
    setImageChanged(false);
    setImageError(null);
  }, [lot]);

  // Redirect non-authors or non-drafts away.
  useEffect(() => {
    if (lot && (!isAuthor || !isDraft)) {
      router.replace(`/lots/${id}`);
    }
  }, [lot, isAuthor, isDraft, router, id]);

  const dirty = useMemo(() => {
    if (!lot) return false;
    if (title !== (lot.title ?? '')) return true;
    if (description !== (lot.description ?? '')) return true;
    if (startPrice !== String(lot.start_price ?? '')) return true;
    if (minStep !== String(lot.min_step ?? '')) return true;
    if (startTime !== toLocalDatetimeInputValue(lot.start_time)) return true;
    if (endTime !== toLocalDatetimeInputValue(lot.end_time)) return true;
    if (imageChanged) return true;
    return false;
  }, [lot, title, description, startPrice, minStep, startTime, endTime, imageChanged]);

  if (isLoading) return <PageShell><LoadingScreen label="Загрузка лота…" /></PageShell>;
  if (isError) return (
    <PageShell>
      <ErrorState title="Не удалось загрузить лот" onRetry={() => refetch()} />
    </PageShell>
  );
  if (!lot) return null;
  if (!isAuthor || !isDraft) return <LoadingScreen />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: UpdateLotPayload = {};
    if (title !== lot.title) payload.title = title;
    if (description !== lot.description) payload.description = description;
    const sp = Number(startPrice);
    if (!Number.isNaN(sp) && sp !== lot.start_price) payload.start_price = sp;
    const ms = Number(minStep);
    if (!Number.isNaN(ms) && ms !== lot.min_step) payload.min_step = ms;
    if (startTime !== toLocalDatetimeInputValue(lot.start_time)) {
      payload.start_time = startTime ? new Date(startTime).toISOString() : null;
    }
    if (endTime !== toLocalDatetimeInputValue(lot.end_time)) {
      payload.end_time = endTime ? new Date(endTime).toISOString() : null;
    }
    if (imageChanged) payload.image_url = imageBase64;

    try {
      await updateLot.mutateAsync({ id, payload });
      toast.success('Черновик сохранён');
      setRedirecting(true);
      router.push(`/lots/${id}`);
    } catch (err) {
      const msg = err instanceof ApiErrorImpl ? err.message : 'Не удалось сохранить черновик';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <Link
        href={`/lots/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> К лоту
      </Link>

      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Редактирование черновика</CardTitle>
            <p className="text-sm text-muted-foreground">
              Измените нужные поля. Передаются только изменённые значения.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="title">Название</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="start_price">Стартовая цена, ₽</Label>
                  <Input
                    id="start_price"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={startPrice}
                    onChange={(e) => setStartPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="min_step">Минимальный шаг, ₽</Label>
                  <Input
                    id="min_step"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={minStep}
                    onChange={(e) => setMinStep(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="start_time">Начало торгов (опционально)</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_time">Окончание торгов (опционально)</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lot-image">Изображение лота (опционально)</Label>
                {imagePreview ? (
                  <div className="relative w-full max-w-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Превью изображения лота"
                      className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageBase64(null);
                        setImagePreview(null);
                        setImageChanged(true);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground shadow-sm hover:bg-background"
                      aria-label="Удалить изображение"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="lot-image"
                    className="flex aspect-[4/3] w-full max-w-xs cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
                  >
                    {converting ? (
                      <Loader2 className="mb-2 h-6 w-6 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="mb-2 h-6 w-6" aria-hidden />
                    )}
                    <span className="text-sm font-medium">Загрузить изображение</span>
                    <span className="mt-0.5 text-xs">JPG или PNG, до 5 МБ</span>
                  </label>
                )}
                <input
                  ref={fileInputRef}
                  id="lot-image"
                  type="file"
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const validation = validateImageFile(file);
                    if (!validation.ok) {
                      setImageError(validation.error ?? 'Недопустимый файл');
                      return;
                    }
                    setImageError(null);
                    setConverting(true);
                    try {
                      const previewUrl = URL.createObjectURL(file);
                      setImagePreview(previewUrl);
                      const base64 = await readFileAsDataUrl(file);
                      setImageBase64(base64);
                      setImageChanged(true);
                    } catch {
                      setImageError('Не удалось обработать файл');
                    } finally {
                      setConverting(false);
                    }
                  }}
                />
                {imageError && (
                  <p className="text-xs text-destructive">{imageError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" asChild disabled={submitting || redirecting}>
                  <Link href={`/lots/${id}`}>Отмена</Link>
                </Button>
                <Button type="submit" disabled={submitting || !dirty || redirecting || converting}>
                  {(submitting || redirecting) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {submitting ? 'Сохранение…' : redirecting ? 'Перенаправление…' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
