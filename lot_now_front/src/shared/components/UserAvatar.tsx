'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsFrom } from '@/src/shared/lib/format';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  className?: string;
}

export function UserAvatar({ username, avatarUrl, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('h-6 w-6', className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={username} /> : null}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {initialsFrom(username)}
      </AvatarFallback>
    </Avatar>
  );
}
