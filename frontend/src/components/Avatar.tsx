import React from 'react';
import { cn, getAvatarColor, getAvatarInitials } from '../lib/utils';

interface AvatarProps {
  name: string;
  className?: string;
}

export default function Avatar({ name, className }: AvatarProps) {
  const bg = getAvatarColor(name);
  const initials = getAvatarInitials(name);
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full text-white font-medium select-none shrink-0',
        className
      )}
      style={{ backgroundColor: bg }}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
}
