'use client';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
export function CopyButton({ value }: { value: string }) {
  return (
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon"
      onClick={() => navigator.clipboard.writeText(value).then(() => toast('Copied'))}><Copy /></Button>} />
    <TooltipContent>Copy</TooltipContent></Tooltip>
  );
}
