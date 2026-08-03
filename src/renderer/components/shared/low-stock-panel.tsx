import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BellOff, ChevronDown, PackagePlus } from 'lucide-react';
import type { LowStockProductDto } from '@shared/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  dismissLowStockProduct,
  filterVisibleLowStock,
} from '@/utils/low-stock-dismiss';
import { cn, formatCurrency } from '@/utils';

function stockLabel(item: LowStockProductDto): string {
  if (item.stockQuantity <= 0) return 'Zerado';
  if (item.unitsShort > 0) return `Faltam ${item.unitsShort} un.`;
  return `${item.stockQuantity}/${item.minStock}`;
}

interface LowStockPanelProps {
  items: LowStockProductDto[];
  /** Compacto para dashboard. */
  compact?: boolean;
  /** Começa expandido (padrão false — oculto). */
  defaultExpanded?: boolean;
  onRestock?: (productId: string) => void;
  onDismissChange?: () => void;
  showViewAll?: boolean;
}

export function LowStockPanel({
  items,
  compact = false,
  defaultExpanded = false,
  onRestock,
  onDismissChange,
  showViewAll = false,
}: LowStockPanelProps) {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const visible = useMemo(() => filterVisibleLowStock(items), [items, version]);

  if (visible.length === 0) return null;

  const critical = visible.filter((i) => i.urgency === 'critical');
  const warning = visible.filter((i) => i.urgency === 'warning');

  function handleDismiss(id: string) {
    dismissLowStockProduct(id, 1);
    setVersion((n) => n + 1);
    onDismissChange?.();
  }

  function handleRestock(id: string) {
    if (onRestock) {
      onRestock(id);
      return;
    }
    navigate(`/estoque?entrada=1&produto=${encodeURIComponent(id)}`);
  }

  return (
    <Card
      className={
        critical.length > 0
          ? 'border-rose-300/70 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/20'
          : 'border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20'
      }
    >
      <CardHeader className={cn(compact ? 'pb-2' : undefined, !expanded && 'pb-4')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
              critical.length > 0
                ? 'text-rose-800 dark:text-rose-200'
                : 'text-amber-800 dark:text-amber-200'
            }`}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Ocultar alertas' : 'Expandir alertas'}
          >
            <ChevronDown
              className={cn(
                'h-5 w-5 shrink-0 transition-transform duration-200',
                !expanded && '-rotate-90',
              )}
            />
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <CardTitle className="text-base">Estoque baixo ({visible.length})</CardTitle>
          </button>
          <div className="flex items-center gap-2">
            {showViewAll ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/estoque?estoqueBaixo=1')}
              >
                Ver todos
              </Button>
            ) : null}
          </div>
        </div>
        {expanded && !compact ? (
          <p className="pl-7 text-sm text-muted-foreground">
            {critical.length > 0 ? `${critical.length} zerado(s)` : null}
            {critical.length > 0 && warning.length > 0 ? ' · ' : null}
            {warning.length > 0 ? `${warning.length} abaixo do mínimo` : null}
          </p>
        ) : null}
        {!expanded ? (
          <p className="pl-7 text-xs text-muted-foreground">
            Clique para expandir
            {critical.length > 0 ? ` · ${critical.length} crítico(s)` : ''}
          </p>
        ) : null}
      </CardHeader>
      {expanded ? (
        <CardContent className="space-y-2">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/70 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <Badge variant={item.urgency === 'critical' ? 'destructive' : 'warning'}>
                    {item.urgency === 'critical' ? 'Crítico' : 'Atenção'}
                  </Badge>
                  {item.isHighDemand ? (
                    <Badge variant="muted">Alta demanda</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.categoryName}
                  {' · '}
                  {stockLabel(item)}
                  {item.minStock > 0 ? ` · mín. ${item.minStock}` : null}
                  {' · '}
                  estoque{' '}
                  {formatCurrency(
                    (Number(item.cost) * Math.max(item.stockQuantity, 0)).toFixed(2),
                  )}{' '}
                  em custo
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRestock(item.id)}
                  title="Registrar entrada"
                >
                  <PackagePlus className="h-4 w-4" />
                  {!compact ? ' Reabastecer' : null}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Silenciar por 1 dia"
                  onClick={() => handleDismiss(item.id)}
                >
                  <BellOff className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
