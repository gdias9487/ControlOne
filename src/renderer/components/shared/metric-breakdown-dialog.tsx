import type { MetricBreakdown } from '@shared/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatCurrency } from '@/utils';

interface MetricBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: MetricBreakdown | null;
}

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

function toneForBreakdown(id: string): Tone {
  switch (id) {
    case 'monthlyRevenue':
      return 'success';
    case 'openFiado':
    case 'soldCostsFiado':
      return 'warning';
    case 'monthlyExpenses':
    case 'soldCosts':
      return 'danger';
    case 'totalAfterExpenses':
      return 'neutral';
    default:
      return 'neutral';
  }
}

const toneText = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-foreground',
} as const;

const toneTextStrong = {
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-rose-700 dark:text-rose-300',
  neutral: 'text-foreground',
} as const;

const toneSurface = {
  success: 'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30',
  warning: 'border-amber-200/80 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30',
  danger: 'border-rose-200/80 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30',
  neutral: 'border-border bg-muted/20',
} as const;

const toneTotalSurface = {
  success: 'bg-emerald-50 dark:bg-emerald-950/40',
  warning: 'bg-amber-50 dark:bg-amber-950/40',
  danger: 'bg-rose-50 dark:bg-rose-950/40',
  neutral: 'bg-muted/50',
} as const;

export function MetricBreakdownDialog({
  open,
  onOpenChange,
  breakdown,
}: MetricBreakdownDialogProps) {
  if (!breakdown) return null;

  const tone = toneForBreakdown(breakdown.id);
  const isFormula = breakdown.id === 'totalAfterExpenses';

  function lineTone(sign: '+' | '-'): Tone {
    if (!isFormula) return tone;
    return sign === '+' ? 'success' : 'danger';
  }

  const totalTone: Tone =
    Number(breakdown.total) < 0
      ? 'danger'
      : Number(breakdown.total) > 0
        ? isFormula
          ? 'success'
          : tone
        : 'neutral';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-4 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className={cn(toneTextStrong[tone])}>{breakdown.title}</DialogTitle>
          {breakdown.description ? (
            <DialogDescription>{breakdown.description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {breakdown.lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum lançamento neste período.
            </p>
          ) : (
            breakdown.lines.map((line, index) => {
              const lt = lineTone(line.sign);
              return (
                <div
                  key={`${line.label}-${index}`}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5',
                    toneSurface[lt],
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className={cn('mr-1.5 font-semibold', toneText[lt])}>
                        {line.sign}
                      </span>
                      {line.label}
                    </p>
                    {line.detail ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{line.detail}</p>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      'shrink-0 font-display text-sm font-semibold tabular-nums',
                      toneTextStrong[lt],
                    )}
                  >
                    {line.sign === '-' ? '−' : ''}
                    {formatCurrency(line.amount)}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t pt-3">
          {breakdown.note ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/40">
              <span className="text-amber-800 dark:text-amber-200">{breakdown.note.label}</span>
              <span className="font-display font-semibold text-amber-700 dark:text-amber-300">
                {formatCurrency(breakdown.note.amount)}
              </span>
            </div>
          ) : null}
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl px-3 py-3',
              toneTotalSurface[totalTone],
            )}
          >
            <span className="text-sm font-medium">{breakdown.totalLabel ?? 'Total'}</span>
            <span
              className={cn(
                'font-display text-xl font-semibold tabular-nums',
                Number(breakdown.total) === 0
                  ? 'text-muted-foreground'
                  : toneTextStrong[totalTone],
              )}
            >
              {formatCurrency(breakdown.total)}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
