import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  filterVisibleLowStock,
  shouldShowLowStockStartup,
  skipLowStockStartupToday,
} from '@/utils/low-stock-dismiss';
import { unwrapApi } from '@/utils';

export function LowStockStartupDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const openedRef = useRef(false);

  const { data: lowStock = [] } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => unwrapApi(await window.cleideApi.inventory.lowStock()),
  });

  const visible = useMemo(() => filterVisibleLowStock(lowStock), [lowStock]);
  const criticalCount = visible.filter((i) => i.urgency === 'critical').length;

  useEffect(() => {
    if (openedRef.current) return;
    if (!shouldShowLowStockStartup()) return;
    if (visible.length === 0) return;
    openedRef.current = true;
    setOpen(true);
  }, [visible.length]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Atenção ao estoque
          </DialogTitle>
          <DialogDescription>
            {criticalCount > 0
              ? `${criticalCount} produto(s) zerado(s) e ${visible.length - criticalCount} abaixo do mínimo.`
              : `${visible.length} produto(s) abaixo do estoque mínimo.`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {visible.slice(0, 8).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.categoryName}</p>
              </div>
              <Badge variant={item.urgency === 'critical' ? 'destructive' : 'warning'}>
                {item.urgency === 'critical' ? 'Zerado' : `Faltam ${item.unitsShort}`}
              </Badge>
            </div>
          ))}
          {visible.length > 8 ? (
            <p className="text-xs text-muted-foreground">+{visible.length - 8} outros</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              skipLowStockStartupToday();
              setOpen(false);
            }}
          >
            Lembrar amanhã
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              navigate('/estoque?estoqueBaixo=1');
            }}
          >
            Ir ao estoque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
