import { useMemo, useState } from 'react';
import { PackagePlus, Plus, Search, X } from 'lucide-react';
import type { ProductDto } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatCurrency } from '@/utils';

export const NEW_PRODUCT_VALUE = '__new_product__';

export type ProductLineSelection =
  | { kind: 'product'; productId: string; productName: string; unitPrice: string }
  | { kind: 'adHoc'; productName: string }
  | { kind: 'newProduct' };

interface ProductLineSelectProps {
  products: ProductDto[];
  productId: string;
  productName: string;
  isAdHoc: boolean;
  disabledIds?: Set<string>;
  onSelect: (selection: ProductLineSelection) => void;
  onClear: () => void;
}

export function ProductLineSelect({
  products,
  productId,
  productName,
  isAdHoc,
  disabledIds,
  onSelect,
  onClear,
}: ProductLineSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedLabel = isAdHoc
    ? productName
      ? `${productName} (avulso)`
      : ''
    : products.find((p) => p.id === productId)?.name ?? '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => !disabledIds?.has(p.id) || p.id === productId);
    if (!q) return list.slice(0, 12);
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.internalCode.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [products, query, disabledIds, productId]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return products.find((p) => p.name.toLowerCase() === q) ?? null;
  }, [products, query]);

  if (selectedLabel) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-xl border bg-card px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{selectedLabel}</p>
          {isAdHoc ? (
            <p className="text-[11px] text-muted-foreground">Sem estoque / sem cadastro</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={onClear}
          aria-label="Trocar produto"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Buscar ou digitar item avulso..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />

      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-elev">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-muted"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSelect({ kind: 'newProduct' });
              setQuery('');
              setOpen(false);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Cadastrar novo produto
          </button>

          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted',
                productId === product.id && 'bg-muted',
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect({
                  kind: 'product',
                  productId: product.id,
                  productName: product.name,
                  unitPrice: product.salePrice,
                });
                setQuery('');
                setOpen(false);
              }}
            >
              <span className="truncate">{product.name}</span>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                {formatCurrency(product.salePrice)}
              </span>
            </button>
          ))}

          {filtered.length === 0 && !query.trim() ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum produto. Digite um nome para venda avulsa.
            </p>
          ) : null}

          {query.trim() && !exactMatch ? (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect({ kind: 'adHoc', productName: query.trim() });
                setQuery('');
                setOpen(false);
              }}
            >
              <PackagePlus className="h-4 w-4" />
              Venda avulsa: “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
