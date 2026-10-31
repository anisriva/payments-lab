'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
    <nav className="flex gap-1">
      {items.map((item) => {
        const active = matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
        if (item.disabled) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={<span className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')} />}>
                {item.label} · soon
              </TooltipTrigger>
              <TooltipContent>Not implemented yet</TooltipContent>
            </Tooltip>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm' }))}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
