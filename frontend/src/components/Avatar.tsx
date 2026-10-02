import React from 'react';
import { cn, getAvatarColor, getAvatarInitials } from '../lib/utils';

interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
}

export default function Avatar({ name, src, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        className={cn('rounded-full object-cover shrink-0', className)}
        referrerPolicy="no-referrer"
      />
    );
  }
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
