import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, FIADO_VALUE_CLASS, formatCurrency, unwrapApi } from '@/utils';
import { toast } from '@/hooks/use-toast';

interface CustomerSearchSelectProps {
  value: string;
  onChange: (customerId: string) => void;
  required?: boolean;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function CustomerSearchSelect({
  value,
  onChange,
  required = false,
  label = 'Cliente',
  compact = false,
  className,
}: CustomerSearchSelectProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['customers-options'],
    queryFn: async () =>
      unwrapApi(await window.cleideApi.customers.list({ page: 1, pageSize: 200 })),
  });

  const customers = data?.items ?? [];
  const selected = customers.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 12);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [customers, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return customers.find((c) => c.name.toLowerCase() === q) ?? null;
  }, [customers, query]);

  const createMutation = useMutation({
    mutationFn: async (name: string) =>
      unwrapApi(await window.cleideApi.customers.create({ name })),
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['customers-options'] });
      onChange(customer.id);
      setQuery('');
      setOpen(false);
      setCreating(false);
      toast({ title: 'Cliente cadastrado', description: customer.name });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className={cn(compact ? 'space-y-1' : 'space-y-2', className)}>
      <Label className={cn(compact && 'text-xs')}>
        {label}
        {required ? ' (obrigatório no fiado)' : ' (opcional)'}
      </Label>

      {selected ? (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border bg-card px-3',
            compact ? 'h-9 py-0' : 'py-2',
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            {!compact && selected.openFiadoTotal && Number(selected.openFiadoTotal) > 0 ? (
              <p className={`text-xs ${FIADO_VALUE_CLASS}`}>
                Fiado {formatCurrency(selected.openFiadoTotal)}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(compact && 'h-7 w-7')}
            onClick={() => onChange('')}
            aria-label="Remover cliente"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={cn('pl-9', compact && 'h-9')}
            placeholder={compact ? 'Buscar cliente...' : 'Digite o nome do cliente...'}
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
              {isLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Carregando clientes...</p>
              ) : null}

              {isError ? (
                <p className="px-3 py-2 text-sm text-destructive">
                  {(error as Error)?.message || 'Não foi possível carregar os clientes.'}
                </p>
              ) : null}

              {!isLoading && !isError
                ? filtered.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted',
                        value === customer.id && 'bg-muted',
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(customer.id);
                        setQuery('');
                        setOpen(false);
                      }}
                    >
                      <span>{customer.name}</span>
                      <span className="flex items-center gap-2">
                        {Number(customer.openFiadoTotal ?? 0) > 0 ? (
                          <span className={`text-xs ${FIADO_VALUE_CLASS}`}>
                            {formatCurrency(customer.openFiadoTotal ?? '0')}
                          </span>
                        ) : null}
                        {value === customer.id ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </button>
                  ))
                : null}

              {!isLoading && !isError && filtered.length === 0 && !query.trim() ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum cliente cadastrado. Digite um nome para criar.
                </p>
              ) : null}

              {!isLoading && !isError && filtered.length === 0 && query.trim() ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum cliente encontrado.
                </p>
              ) : null}

              {query.trim() && !exactMatch ? (
                <button
                  type="button"
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={createMutation.isPending || creating}
                  onClick={() => {
                    setCreating(true);
                    createMutation.mutate(query.trim());
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar “{query.trim()}”
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
