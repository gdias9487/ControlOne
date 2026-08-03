import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FIADO_VALUE_CLASS, formatCurrency, toMoneyInput } from '@/utils';

interface SettleFiadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  remaining: string;
  total: string;
  alreadyPaid?: string;
  pending?: boolean;
  onConfirm: (amount: string) => void;
}

export function SettleFiadoDialog({
  open,
  onOpenChange,
  title = 'Pagar fiado',
  remaining,
  total,
  alreadyPaid = '0.00',
  pending = false,
  onConfirm,
}: SettleFiadoDialogProps) {
  const [amount, setAmount] = useState(remaining);

  useEffect(() => {
    if (open) setAmount(remaining);
  }, [open, remaining]);

  function submit(payAll = false) {
    const value = payAll ? remaining : toMoneyInput(amount);
    onConfirm(value);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Informe o valor recebido. Pode quitar parcialmente ou o total em aberto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border bg-muted/30 px-3 py-2 space-y-1">
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground">Total</span>
              <span>{formatCurrency(total)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground">Já pago</span>
              <span>{formatCurrency(alreadyPaid)}</span>
            </p>
            <p className="flex justify-between gap-3 font-medium">
              <span>Em aberto</span>
              <span className={FIADO_VALUE_CLASS}>{formatCurrency(remaining)}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Valor do pagamento</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={remaining}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => submit(true)}>
              Quitar tudo
            </Button>
            <Button type="button" disabled={pending} onClick={() => submit(false)}>
              Registrar pagamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
