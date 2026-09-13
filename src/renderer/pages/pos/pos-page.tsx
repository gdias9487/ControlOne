import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Minus, PackagePlus, Plus, Printer, Search, Trash2 } from 'lucide-react';
import type { SaleCreateInput } from '@shared/schemas';
import type { ProductDto, SaleDto } from '@shared/types';
import {
  cashPortion,
  hasFiado,
  primaryPaymentMethod,
  resolveDraftPayments,
  salePaymentsLabel,
} from '@shared/utils/sale-payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_SALE_PAYMENTS,
  PaymentSplitEditor,
  type PaymentDraft,
} from '@/components/shared/payment-split-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CustomerSearchSelect } from '@/components/shared/customer-search-select';
import { buildSaleReceiptHtml, printSaleReceipt } from '@/lib/sale-receipt';
import { useTheme } from '@/contexts/theme-context';
import { toast } from '@/hooks/use-toast';
import { cn, formatCurrency, formatMoneyDigits, toMoneyInput, unwrapApi } from '@/utils';

type CartLine = {
  key: string;
  productId: string | null;
  productName: string;
  isAdHoc: boolean;
  quantity: number;
  unitPrice: string;
};

function lineKey(productId: string | null, productName: string) {
  return productId ? `p:${productId}` : `a:${productName.trim().toLowerCase()}`;
}

export function PosPage() {
  const queryClient = useQueryClient();
  const { settings } = useTheme();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>(DEFAULT_SALE_PAYMENTS);
  const [customerId, setCustomerId] = useState('');
  const [received, setReceived] = useState('');
  const [pendingSale, setPendingSale] = useState<SaleCreateInput | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [sessionSales, setSessionSales] = useState<SaleDto[]>([]);
  const [saleTried, setSaleTried] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    searchRef.current?.focus();
  }, [completedSale]);

  const { data: productsData } = useQuery({
    queryKey: ['pos-products', debouncedQuery],
    queryFn: async () =>
      unwrapApi(
        await window.cleideApi.products.list({
          page: 1,
          pageSize: 200,
          sortBy: 'name',
          sortOrder: 'asc',
          status: 'ACTIVE',
          search: debouncedQuery || undefined,
        }),
      ),
  });

  const products = productsData?.items ?? [];

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.internalCode.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, query]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, line) => {
      const price = Number(toMoneyInput(line.unitPrice) || '0');
      return acc + price * Math.max(0, line.quantity);
    }, 0);
    return {
      count: lines.reduce((acc, line) => acc + line.quantity, 0),
      subtotal: subtotal.toFixed(2),
    };
  }, [lines]);

  const resolvedPayments = useMemo(
    () => resolveDraftPayments(payments, totals.subtotal),
    [payments, totals.subtotal],
  );
  const cashAmount = Number(
    cashPortion(resolvedPayments ?? payments.filter((payment) => payment.method === 'CASH')),
  );
  const usesFiado = payments.some((payment) => payment.method === 'FIADO');
  const receivedValue = Number(toMoneyInput(received) || '0');
  const change =
    cashAmount > 0 && received.trim()
      ? Math.max(0, receivedValue - cashAmount).toFixed(2)
      : null;

  const saleMutation = useMutation({
    mutationFn: async (payload: SaleCreateInput) =>
      unwrapApi(await window.cleideApi.sales.create(payload)),
    onSuccess: (sale) => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      setPendingSale(null);
      setCompletedSale(sale);
      setSessionSales((prev) => [sale, ...prev.filter((item) => item.id !== sale.id)]);
      resetCart();
      toast({ title: `Venda ${sale.saleNumber} registrada` });
    },
    onError: (err: Error, values) => {
      if (err.message.includes('Estoque insuficiente')) {
        setPendingSale(values);
        return;
      }
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  function resetCart() {
    setLines([]);
    setQuery('');
    setReceived('');
    setPayments(DEFAULT_SALE_PAYMENTS);
    setCustomerId('');
    setSaleTried(false);
  }

  function addProduct(product: ProductDto) {
    setLines((prev) => {
      const key = lineKey(product.id, product.name);
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        return prev.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          productName: product.name,
          isAdHoc: false,
          quantity: 1,
          unitPrice: product.salePrice,
        },
      ];
    });
    setQuery('');
    searchRef.current?.focus();
  }

  function addAdHoc(name: string) {
    const productName = name.trim();
    if (!productName) return;
    setLines((prev) => {
      const key = lineKey(null, productName);
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        return prev.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...prev,
        {
          key,
          productId: null,
          productName,
          isAdHoc: true,
          quantity: 1,
          unitPrice: '',
        },
      ];
    });
    setQuery('');
    searchRef.current?.focus();
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function submitFromSearch() {
    const q = query.trim();
    if (!q) return;
    const exactCode = products.find((p) => p.internalCode.toLowerCase() === q.toLowerCase());
    if (exactCode) {
      addProduct(exactCode);
      return;
    }
    const exactName = products.find((p) => p.name.toLowerCase() === q.toLowerCase());
    if (exactName) {
      addProduct(exactName);
      return;
    }
    if (suggestions.length === 1) {
      addProduct(suggestions[0]);
      return;
    }
    if (suggestions.length === 0) {
      addAdHoc(q);
    }
  }

  function buildPayload(allowNegativeStock = false): SaleCreateInput | null {
    setSaleTried(true);
    const resolved = resolveDraftPayments(payments, totals.subtotal);
    if (!resolved) {
      toast({
        title: 'Pagamento incompleto',
        description: 'A soma das formas deve ser igual ao total da venda.',
        variant: 'destructive',
      });
      return null;
    }
    if (hasFiado(resolved) && !customerId) {
      toast({
        title: 'Cliente obrigatório',
        description: 'Selecione o cliente para a parcela fiada.',
        variant: 'destructive',
      });
      return null;
    }
    if (lines.some((line) => line.isAdHoc && !String(line.unitPrice).trim())) {
      toast({
        title: 'Valor obrigatório',
        description: 'Informe o valor de cada item avulso.',
        variant: 'destructive',
      });
      return null;
    }
    const items = lines
      .filter((line) => line.quantity > 0 && (line.productId || line.productName.trim()))
      .map((line) =>
        line.isAdHoc
          ? {
              productId: null,
              productName: line.productName.trim(),
              quantity: line.quantity,
              unitPrice: toMoneyInput(line.unitPrice),
              discountPercent: '0',
            }
          : {
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: toMoneyInput(line.unitPrice),
              discountPercent: '0',
            },
      );
    if (items.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Busque um produto ou digite um item avulso.',
        variant: 'destructive',
      });
      return null;
    }
    return {
      items,
      discountPercent: '0',
      paymentMethod: primaryPaymentMethod(resolved),
      payments: resolved,
      customerId: customerId || null,
      notes: null,
      allowNegativeStock,
    };
  }

  function finalize(allowNegativeStock = false) {
    const payload = buildPayload(allowNegativeStock);
    if (!payload) return;
    saleMutation.mutate(payload);
  }

  const finalizeRef = useRef(finalize);
  finalizeRef.current = finalize;
  const completedSaleRef = useRef(completedSale);
  completedSaleRef.current = completedSale;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'F12') return;
      event.preventDefault();
      if (completedSaleRef.current) return;
      finalizeRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-[88px] shrink-0 items-center justify-between gap-4 border-b px-6">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight">Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Enter adiciona · F12 finaliza · item sem cadastro vira venda avulsa
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{settings?.storeName}</p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <section className="flex min-h-0 flex-col rounded-2xl border bg-card p-4 shadow-soft">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              className="h-12 pl-10 text-base"
              placeholder="Nome, código ou item avulso..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitFromSearch();
                }
              }}
            />
          </div>

          {query.trim() ? (
            <div className="mt-2 max-h-52 overflow-auto rounded-xl border bg-popover p-1">
              {suggestions.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => addProduct(product)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{product.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {product.internalCode} · estoque {product.stockQuantity}
                    </span>
                  </span>
                  <span className="ml-3 shrink-0 font-medium">{formatCurrency(product.salePrice)}</span>
                </button>
              ))}
              {suggestions.length === 0 ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => addAdHoc(query)}
                >
                  <PackagePlus className="h-4 w-4" />
                  Venda avulsa: “{query.trim()}”
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 min-h-0 flex-1 overflow-auto">
            {lines.length === 0 ? (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                O carrinho está vazio. Busque um produto para começar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-2 font-medium">Item</th>
                    <th className="w-28 pb-2 pr-2 font-medium">Qtd.</th>
                    <th className="w-36 pb-2 pr-2 font-medium">Valor</th>
                    <th className="w-28 pb-2 pr-2 text-right font-medium">Subtotal</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const subtotal =
                      Number(toMoneyInput(line.unitPrice) || '0') * line.quantity;
                    return (
                      <tr key={line.key} className="border-t">
                        <td className="py-2 pr-2">
                          <p className="font-medium">{line.productName}</p>
                          {line.isAdHoc ? (
                            <p className="text-xs text-muted-foreground">Avulso · sem estoque</p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() =>
                                updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })
                              }
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              className="h-8 w-12 px-1 text-center"
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <MoneyInput
                            className="h-8"
                            value={line.unitPrice}
                            allowEmpty={line.isAdHoc}
                            invalid={saleTried && line.isAdHoc && !String(line.unitPrice).trim()}
                            onChange={(unitPrice) => updateLine(line.key, { unitPrice })}
                          />
                        </td>
                        <td className="py-2 pr-2 text-right font-medium">
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="py-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                            aria-label="Remover item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 min-h-0 border-t pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" />
                Vendas desta sessão
              </p>
              <p className="text-xs text-muted-foreground">
                {sessionSales.length} {sessionSales.length === 1 ? 'venda' : 'vendas'}
                {sessionSales.length > 0
                  ? ` · ${formatCurrency(
                      sessionSales.reduce((acc, sale) => acc + Number(sale.total), 0),
                    )}`
                  : ''}
              </p>
            </div>
            {sessionSales.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                As vendas finalizadas neste caixa aparecem aqui até sair da sessão.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-auto">
                {sessionSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setCompletedSale(sale)}
                    >
                      <span className="font-medium">{sale.saleNumber}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(sale.soldAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {salePaymentsLabel(sale)}
                      </span>
                    </button>
                    <span className="shrink-0 font-medium">{formatCurrency(sale.total)}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => printSaleReceipt(sale, settings)}
                      aria-label={`Imprimir ${sale.saleNumber}`}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft">
          <div className="rounded-2xl bg-muted/60 px-4 py-5">
            <p className="text-sm text-muted-foreground">
              {totals.count} {totals.count === 1 ? 'item' : 'itens'}
            </p>
            <p className="font-display text-4xl font-semibold tracking-tight">
              {formatCurrency(totals.subtotal)}
            </p>
          </div>

          <PaymentSplitEditor
            variant="buttons"
            total={totals.subtotal}
            payments={payments}
            onChange={setPayments}
          />

          {cashAmount > 0 ? (
            <div className="space-y-2">
              <Label>Valor recebido em dinheiro</Label>
              <MoneyInput
                className="h-11 text-base"
                value={received}
                allowEmpty
                onChange={setReceived}
                placeholder={formatMoneyDigits(cashAmount)}
              />
              {change ? (
                <p className="text-sm">
                  Troco:{' '}
                  <span className="font-semibold">{formatCurrency(change)}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <CustomerSearchSelect
            value={customerId}
            onChange={setCustomerId}
            required={usesFiado}
            invalid={saleTried && usesFiado && !customerId}
          />

          <div className="mt-auto space-y-2">
            <Button
              className="h-14 w-full text-base"
              disabled={saleMutation.isPending || lines.length === 0}
              onClick={() => finalize()}
            >
              Finalizar venda
              <span className="ml-2 text-xs opacity-70">F12</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={resetCart}
              disabled={lines.length === 0}
            >
              Limpar carrinho
            </Button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(pendingSale)}
        onOpenChange={(o) => !o && setPendingSale(null)}
        title="Estoque insuficiente"
        description="Deseja concluir a venda mesmo com estoque negativo?"
        confirmLabel="Permitir negativo"
        onConfirm={() => pendingSale && saleMutation.mutate({ ...pendingSale, allowNegativeStock: true })}
      />

      <Dialog open={Boolean(completedSale)} onOpenChange={(open) => !open && setCompletedSale(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>Venda {completedSale?.saleNumber}</DialogTitle>
            <DialogDescription>
              Cupom não fiscal pronto para imprimir ou só conferir na tela.
            </DialogDescription>
          </DialogHeader>
          {completedSale ? (
            <div className="space-y-3">
              <p className={cn('text-lg font-semibold')}>
                Total {formatCurrency(completedSale.total)}
              </p>
              <iframe
                title="Prévia do cupom"
                className="h-[420px] w-full rounded-xl border bg-white"
                srcDoc={buildSaleReceiptHtml(completedSale, settings)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCompletedSale(null)}>
                  Nova venda
                </Button>
                <Button
                  type="button"
                  onClick={() => printSaleReceipt(completedSale, settings)}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
