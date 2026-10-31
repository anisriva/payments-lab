import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function RefCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block max-w-40 truncate font-mono text-xs" />}>
        {value}
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}
