'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function LinkTabs({
  items,
  matchPrefix,
}: {
  items: { href: string; label: string; disabled?: boolean }[];
  matchPrefix?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4 border-b">
      {items.map((item) => {
        const active = matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
        if (item.disabled) {
          return (
            <span key={item.href} className="px-2 py-2 text-sm text-muted-foreground">
              {item.label} · soon
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-2 py-2 text-sm border-b-2 -mb-px',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
