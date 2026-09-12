'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gavel, LogOut, Plus, ListOrdered, Menu, ImagePlus, Loader2, UserCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { authApi } from '@/src/shared/api/endpoints';
import { ApiErrorImpl } from '@/src/shared/api/client';
import { initialsFrom } from '@/src/shared/lib/format';
import { validateImageFile, readFileAsDataUrl } from '@/src/shared/lib/file';
import { UserAvatar } from '@/src/shared/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';

const NAV_LINKS = [
  { href: '/lots', label: 'Лоты', icon: ListOrdered },
  { href: '/lots/new', label: 'Создать лот', icon: Plus },
  { href: '/profile', label: 'Профиль', icon: UserCircle },
];

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout, refetchUser } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/lots"
            className="flex items-center gap-2 text-foreground"
            aria-label="LotNow — на главную"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Gavel className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight">
              LotNow
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <AvatarUploadMenu
              username={user.username}
              avatarUrl={user.avatar_url ?? null}
              onLogout={logout}
              onUploaded={() => {
                refetchUser();
              }}
            />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Войти</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Регистрация</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Открыть меню"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="mb-4 flex items-center gap-2">
                <Gavel className="h-4 w-4" /> Меню
              </SheetTitle>
              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                      isActive(link.href)
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60',
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))}
                {!isAuthenticated && (
                  <>
                    <div className="my-2 h-px bg-border" />
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60"
                    >
                      Войти
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                    >
                      Регистрация
                    </Link>
                  </>
                )}
                {isAuthenticated && (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Выйти
                  </button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function AvatarUploadMenu({
  username,
  avatarUrl,
  onLogout,
  onUploaded,
}: {
  username: string;
  avatarUrl: string | null;
  onLogout: () => void;
  onUploaded: () => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validation = validateImageFile(f);
    if (!validation.ok) {
      setError(validation.error ?? 'Недопустимый файл');
      setFile(null);
      setPreview(null);
      return;
    }
    setError(null);
    setFile(f);
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setPreview(dataUrl);
    } catch {
      setError('Не удалось загрузить превью');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await authApi.uploadAvatar(file);
      toast.success('Аватар обновлён');
      reset();
      setUploadOpen(false);
      onUploaded();
    } catch (e) {
      const msg = e instanceof ApiErrorImpl ? e.message : 'Не удалось загрузить аватар';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 py-1 text-sm font-medium transition-colors hover:bg-secondary"
          aria-label="Меню пользователя"
        >
          <UserAvatar username={username} avatarUrl={avatarUrl} />
          <span className="hidden sm:inline">{username}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <UserAvatar username={username} avatarUrl={avatarUrl} className="h-8 w-8" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{username}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserCircle className="mr-2 h-4 w-4" /> Профиль
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/lots/new" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" /> Создать лот
          </Link>
        </DropdownMenuItem>
        <Dialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) reset();
          }}
        >
          <DialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="cursor-pointer"
            >
              <ImagePlus className="mr-2 h-4 w-4" /> Сменить аватар
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Загрузить аватар</DialogTitle>
              <DialogDescription>
                JPG или PNG, до 5 МБ. Круглое изображение.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-2">
              {preview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Превью аватара"
                    className="h-24 w-24 rounded-full border border-border object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
                  <UserAvatar
                    username={username}
                    avatarUrl={avatarUrl}
                    className="h-20 w-20"
                  />
                </div>
              )}

              <input
                ref={fileInputRef}
                id="avatar-file"
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                onChange={handleFileChange}
              />
              <label
                htmlFor="avatar-file"
                className="cursor-pointer rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              >
                Выбрать файл
              </label>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Отмена
              </Button>
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {uploading ? 'Загрузка…' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
