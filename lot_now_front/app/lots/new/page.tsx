'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/src/features/auth/ProtectedRoute';
import { useCreateLot } from '@/src/features/lots/lotsQueries';
import { lotsApi } from '@/src/shared/api/endpoints';
import { createLotSchema, type CreateLotValues } from '@/src/features/auth/schemas';
import { ApiErrorImpl } from '@/src/shared/api/client';
import { validateImageFile, readFileAsDataUrl } from '@/src/shared/lib/file';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/src/shared/components/PageShell';
import { LotImage } from '@/src/shared/components/LotImage';
import { ArrowLeft, Upload, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NewLotPage() {
  return (
    <ProtectedRoute>
      <NewLotForm />
    </ProtectedRoute>
  );
}

function NewLotForm() {
  const router = useRouter();
  const createLot = useCreateLot();
  const [submitting, setSubmitting] = useState<null | 'draft' | 'publish'>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateLotValues>({
    resolver: zodResolver(createLotSchema),
    defaultValues: {
      title: '',
      description: '',
      start_price: 1000,
      min_step: 100,
      start_time: toLocalDatetimeInputValue(inOneHour),
      end_time: toLocalDatetimeInputValue(inOneDay),
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setImageError(validation.error ?? 'Недопустимый файл');
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageError(null);
    setImageFile(file);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
    } catch {
      setImageError('Не удалось загрузить превью');
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (values: CreateLotValues, mode: 'draft' | 'publish') => {
    // When publishing, require start_time and end_time.
    if (mode === 'publish') {
      if (!values.start_time) {
        toast.error('Укажите время начала торгов для публикации');
        setSubmitting(null);
        return;
      }
      if (!values.end_time) {
        toast.error('Укажите время окончания торгов для публикации');
        setSubmitting(null);
        return;
      }
    }
    setSubmitting(mode);
    try {
      const payload = {
        ...values,
        start_time: values.start_time
          ? new Date(values.start_time).toISOString()
          : undefined,
        end_time: values.end_time
          ? new Date(values.end_time).toISOString()
          : undefined,
        image_url: imageBase64
      };
      const lot = await createLot.mutateAsync(payload);

      if (mode === 'publish') {
        try {
          await lotsApi.publish(lot.id);
          toast.success('Лот опубликован');
        } catch (e) {
          const msg =
            e instanceof ApiErrorImpl
              ? e.message
              : 'Лот создан, но публикация не удалась';
          toast.warning(msg);
        }
      } else {
        toast.success('Лот сохранён как черновик');
      }
      router.push(`/lots/${lot.id}`);
    } catch (e) {
      const msg = e instanceof ApiErrorImpl ? e.message : 'Не удалось создать лот';
      toast.error(msg);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <PageShell>
      <Link
        href="/lots"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> К списку лотов
      </Link>

      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Новый лот</CardTitle>
            <p className="text-sm text-muted-foreground">
              Заполните параметры аукциона. Время указывается в вашем часовом поясе.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => onSubmit(v, 'draft'))} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="title">Название</Label>
                <Input
                  id="title"
                  placeholder="Например: Редкие часы Rolex 1965"
                  aria-invalid={!!errors.title}
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Состояние, история, документы…"
                  aria-invalid={!!errors.description}
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Image upload */}
              <div className="space-y-1.5">
                <Label htmlFor="lot-image">Изображение лота</Label>
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
                      onClick={clearImage}
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
                    <Upload className="mb-2 h-6 w-6" aria-hidden />
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
                  onChange={handleFileChange}
                />
                {imageError && (
                  <p className="text-xs text-destructive">{imageError}</p>
                )}
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
                    aria-invalid={!!errors.start_price}
                    {...register('start_price')}
                  />
                  {errors.start_price && (
                    <p className="text-xs text-destructive">
                      {errors.start_price.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="min_step">Минимальный шаг, ₽</Label>
                  <Input
                    id="min_step"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    aria-invalid={!!errors.min_step}
                    {...register('min_step')}
                  />
                  {errors.min_step && (
                    <p className="text-xs text-destructive">
                      {errors.min_step.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="start_time">Начало торгов</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    aria-invalid={!!errors.start_time}
                    {...register('start_time')}
                  />
                  {errors.start_time && (
                    <p className="text-xs text-destructive">
                      {errors.start_time.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_time">Окончание торгов</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    aria-invalid={!!errors.end_time}
                    {...register('end_time')}
                  />
                  {errors.end_time && (
                    <p className="text-xs text-destructive">
                      {errors.end_time.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" asChild>
                  <Link href="/lots">Отмена</Link>
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={submitting !== null}
                    className="flex-1"
                  >
                    {submitting === 'draft' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {submitting === 'draft' ? 'Сохранение…' : 'Сохранить черновик'}
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting !== null}
                    className="flex-1"
                    onClick={() => {
                      handleSubmit((v) => onSubmit(v, 'publish'))();
                    }}
                  >
                    {submitting === 'publish' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {submitting === 'publish' ? 'Публикация…' : 'Опубликовать'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
