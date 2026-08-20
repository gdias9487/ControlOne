import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS } from '@shared/constants';
import type { SaleDto } from '@shared/types';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FIADO_VALUE_CLASS,
  formatCurrency,
  formatPercent,
  transactionAmountClass,
} from '@/utils';

interface SaleDetailDialogProps {
  sale: SaleDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
}

export function SaleDetailDialog({ sale, open, onOpenChange, loading = false }: SaleDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Detalhes da venda {sale?.saleNumber}
            {sale ? (
              sale.isFiadoOpen ? (
                <Badge variant="warning">
                  {Number(sale.fiadoPaidAmount) > 0 ? 'Fiado parcial' : 'Fiado aberto'}
                </Badge>
              ) : sale.paymentMethod === 'FIADO' && sale.fiadoPaidAt ? (
                <Badge variant="success">Fiado pago</Badge>
              ) : (
                <Badge variant={sale.status === 'COMPLETED' ? 'success' : 'muted'}>
                  {SALE_STATUS_LABELS[sale.status]}
                </Badge>
              )
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? 'Carregando detalhes...'
              : sale
                ? `${new Date(sale.soldAt).toLocaleString('pt-BR')} · ${
                    sale.customerName ?? 'Sem cliente'
                  } · ${PAYMENT_METHOD_LABELS[sale.paymentMethod]}`
                : null}
          </DialogDescription>
        </DialogHeader>
        {sale ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3">Qtd.</th>
                    <th className="p-3">Valor unit.</th>
                    <th className="p-3">Desc.</th>
                    <th className="p-3">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 font-medium">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {item.productName}
                          {!item.productId ? (
                            <Badge variant="muted">Avulso</Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className="p-3">{item.quantity}</td>
                      <td className="p-3">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3">
                        {Number(item.discountPercent) > 0
                          ? formatPercent(item.discountPercent)
                          : '—'}
                      </td>
                      <td className="p-3">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className={
                sale.isFiadoOpen
                  ? 'rounded-xl bg-amber-200 p-3 text-sm text-amber-950 dark:bg-amber-700/50 dark:text-amber-50'
                  : sale.status === 'COMPLETED'
                    ? 'rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'rounded-xl bg-muted/50 p-3 text-sm'
              }
            >
              <p>Subtotal: {formatCurrency(sale.subtotal)}</p>
              {Number(sale.discount) > 0 ? (
                <p>Desconto: −{formatCurrency(sale.discount)}</p>
              ) : null}
              <p
                className={transactionAmountClass({
                  isFiadoOpen: sale.isFiadoOpen,
                  status: sale.status,
                })}
              >
                Total: {formatCurrency(sale.total)}
              </p>
              {sale.isFiadoOpen ? (
                <p className={FIADO_VALUE_CLASS}>
                  Resta {formatCurrency(sale.fiadoRemaining)}
                  {Number(sale.fiadoPaidAmount) > 0
                    ? ` · Já pago ${formatCurrency(sale.fiadoPaidAmount)}`
                    : ''}
                </p>
              ) : null}
              {sale.notes ? <p className="mt-2 opacity-80">Obs.: {sale.notes}</p> : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const SALE_CODE_REGEX = /VD-\d{4}-\d+/;

/** Destaca o código da venda no motivo e permite abrir os detalhes. */
export function InventoryReasonCell({
  reason,
  saleId,
  onSaleClick,
}: {
  reason: string | null;
  saleId: string | null;
  onSaleClick: (saleId: string) => void;
}) {
  if (!reason) return <span>—</span>;
  if (!saleId) return <span>{reason}</span>;

  const match = reason.match(SALE_CODE_REGEX);
  if (!match || match.index == null) {
    return (
      <button
        type="button"
        className="text-left text-primary underline-offset-2 hover:underline"
        onClick={() => onSaleClick(saleId)}
      >
        {reason}
      </button>
    );
  }

  const before = reason.slice(0, match.index);
  const code = match[0];
  const after = reason.slice(match.index + code.length);

  return (
    <span>
      {before}
      <button
        type="button"
        className="font-medium text-primary underline-offset-2 hover:underline"
        onClick={() => onSaleClick(saleId)}
      >
        {code}
      </button>
      {after}
    </span>
  );
}
