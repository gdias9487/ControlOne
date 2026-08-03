import { Gem, LucideIcon } from 'lucide-react';
import { cn, formatCurrency } from '@/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'gold' | 'silver' | 'danger' | 'success' | 'warning';
  money?: boolean;
  className?: string;
  large?: boolean;
  /** Título do card em negrito. */
  titleBold?: boolean;
  /** Destaca saldo: >0 card verde; =0 branco; <0 card vermelho. */
  profitWhenPositive?: boolean;
  /** Valor pendente (fiado) exibido em amarelo abaixo do saldo. */
  pendingValue?: string | number;
  /** Linha extra abaixo do valor (ex.: custo de fiados). */
  secondaryLine?: {
    label: string;
    value: string | number;
    tone?: 'warning' | 'danger' | 'muted';
    onClick?: () => void;
  };
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  hint,
  icon: Icon = Gem,
  tone = 'default',
  money = false,
  className,
  large = false,
  titleBold = false,
  profitWhenPositive = false,
  pendingValue,
  secondaryLine,
  onClick,
}: StatCardProps) {
  const numeric = Number(value);
  const hasValidNumber = profitWhenPositive && Number.isFinite(numeric);
  const isPositiveProfit = hasValidNumber && numeric > 0;
  const isZeroBalance = hasValidNumber && numeric === 0;
  const isNegativeBalance = hasValidNumber && numeric < 0;
  const showBalanceLabel = isPositiveProfit || isZeroBalance || isNegativeBalance;
  const display = money ? formatCurrency(value) : value;
  const pendingNumeric = pendingValue != null ? Number(pendingValue) : 0;
  const showPending = Number.isFinite(pendingNumeric) && pendingNumeric > 0;
  const resolvedTone = tone === 'gold' ? 'silver' : tone;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'rounded-2xl border bg-card/90 p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elev',
        onClick && 'cursor-pointer hover:border-primary/40',
        isPositiveProfit &&
          'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60',
        isZeroBalance && 'border-border bg-white dark:bg-card',
        isNegativeBalance &&
          'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              'text-sm text-muted-foreground',
              titleBold && 'font-semibold',
              isPositiveProfit && 'text-emerald-700/80 dark:text-emerald-200/80',
              isNegativeBalance && 'text-rose-700/80 dark:text-rose-200/80',
            )}
          >
            {title}
          </p>
          {isPositiveProfit ? (
            <p className="mt-2 text-xs text-emerald-700/70 dark:text-emerald-200/70">Lucro de</p>
          ) : null}
          {isZeroBalance || isNegativeBalance ? (
            <p
              className={cn(
                'mt-2 text-xs',
                isZeroBalance && 'text-muted-foreground',
                isNegativeBalance && 'text-rose-700/70 dark:text-rose-200/70',
              )}
            >
              Resultado do período
            </p>
          ) : null}
          <p
            className={cn(
              'font-display font-semibold tracking-tight',
              showBalanceLabel ? 'mt-0.5' : 'mt-2',
              large ? 'text-3xl' : 'text-2xl',
              !showBalanceLabel && resolvedTone === 'success' && 'text-emerald-600 dark:text-emerald-400',
              !showBalanceLabel && resolvedTone === 'warning' && 'text-amber-600 dark:text-amber-400',
              !showBalanceLabel && resolvedTone === 'danger' && 'text-rose-600 dark:text-rose-400',
              isPositiveProfit && 'text-emerald-700 dark:text-emerald-300',
              isZeroBalance && 'text-muted-foreground',
              isNegativeBalance && 'text-rose-700 dark:text-rose-300',
            )}
          >
            {display}
          </p>
          {showPending ? (
            <p
              className={cn(
                'mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400',
                isPositiveProfit && 'dark:text-amber-300',
              )}
            >
              + {formatCurrency(pendingValue!)} pendente
            </p>
          ) : null}
          {secondaryLine && Number(secondaryLine.value) > 0 ? (
            <p
              role={secondaryLine.onClick ? 'button' : undefined}
              tabIndex={secondaryLine.onClick ? 0 : undefined}
              onClick={
                secondaryLine.onClick
                  ? (e) => {
                      e.stopPropagation();
                      secondaryLine.onClick?.();
                    }
                  : undefined
              }
              onKeyDown={
                secondaryLine.onClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        secondaryLine.onClick?.();
                      }
                    }
                  : undefined
              }
              className={cn(
                'mt-1 text-sm font-semibold',
                secondaryLine.onClick && 'cursor-pointer underline-offset-2 hover:underline',
                secondaryLine.tone === 'danger' && 'text-rose-600 dark:text-rose-400',
                secondaryLine.tone === 'muted' && 'text-muted-foreground',
                (!secondaryLine.tone || secondaryLine.tone === 'warning') &&
                  'text-amber-600 dark:text-amber-400',
              )}
            >
              {secondaryLine.label} {formatCurrency(secondaryLine.value)}
            </p>
          ) : null}
          {hint ? (
            <p
              className={cn(
                'mt-1 text-xs text-muted-foreground',
                isPositiveProfit && 'text-emerald-700/70 dark:text-emerald-200/70',
                isNegativeBalance && 'text-rose-700/70 dark:text-rose-200/70',
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            'rounded-xl p-2.5',
            resolvedTone === 'default' && 'bg-secondary text-primary',
            resolvedTone === 'silver' &&
              'bg-silver-100 text-silver-700 dark:bg-white/10 dark:text-silver-200',
            resolvedTone === 'danger' &&
              'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
            resolvedTone === 'success' &&
              'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
            resolvedTone === 'warning' &&
              'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
            isPositiveProfit &&
              'bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
            isZeroBalance &&
              'bg-secondary text-muted-foreground dark:bg-white/10 dark:text-muted-foreground',
            isNegativeBalance &&
              'bg-rose-200/80 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
