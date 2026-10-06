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
  '#6366F1', // iris
  '#8B5CF6', // lavender
  '#02B8CC', // signal teal
  '#FB724B', // tomato
  '#27A644', // pulse green
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
      return 'bg-[rgba(235,87,87,0.14)] text-[#eb5757] border border-[#eb5757]/30';
    case 'medium':
      return 'bg-[rgba(247,185,40,0.14)] text-[#f7b928] border border-[#f7b928]/30';
    case 'low':
      return 'bg-[rgba(39,166,68,0.14)] text-[#27a644] border border-[#27a644]/30';
    default:
      return 'bg-kf-warm-gray text-kf-slate border border-kf-divider-gray';
  }
}
