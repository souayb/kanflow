import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const AVATAR_COLORS = [
  '#0064E0', // meta blue
  '#9360F7', // grape
  '#F3425F', // cherry
  '#2ABBA7', // teal
  '#FB724B', // tomato
  '#465A69', // icon secondary
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Priority pill styles — DESIGN.md semantic colors */
export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'bg-[rgba(255,123,145,0.15)] text-[#C80A28] border border-[#E41E3F]/30';
    case 'medium':
      return 'bg-[rgba(255,226,0,0.15)] text-[#9a7200] border border-[#F7B928]/40';
    case 'low':
      return 'bg-[rgba(36,228,0,0.12)] text-[#007D1E] border border-[#31A24C]/35';
    default:
      return 'bg-kf-warm-gray text-kf-slate border border-kf-divider-gray';
  }
}
