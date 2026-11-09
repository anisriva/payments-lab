import { Badge } from '@/components/ui/badge';
import type { ValidationCheckResult, ValidationReport } from '@/lib/common/payments/core/connection-checks';

export function ValidationChecklist({ report }: { report: { checks: ValidationCheckResult[]; canSave: boolean } | ValidationReport }) {
  return (
    <div className="space-y-2">
      {report.checks.map((c) => (
        <div key={c.key} className="flex items-start gap-2">
          <Badge
            variant={c.status === 'pass' ? 'secondary' : c.status === 'fail' ? 'destructive' : c.status === 'warn' ? 'secondary' : 'outline'}
          >
            {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : c.status === 'warn' ? '!' : '—'}
          </Badge>
          <div>
            <span className="text-sm">
              {c.label}
              {c.blocking && <span className="text-muted-foreground"> (blocking)</span>}
            </span>
            {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
