import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import type { CustomerPlanDto } from '@shared/types';
import { CUSTOMER_PLAN_STATUS_LABELS, formatPlanDuration } from '@shared/utils/customer-plan';
import { Header } from '@/layouts/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { unwrapApi } from '@/utils';

type PlanFilter = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CANCELLED' | 'ALL';

function planBadge(status: CustomerPlanDto['status']) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'EXPIRING') return 'warning' as const;
  if (status === 'EXPIRED') return 'muted' as const;
  return 'muted' as const;
}

export function ActivePlansPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PlanFilter>('ACTIVE');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-plans', search, status, page],
    queryFn: async () =>
      unwrapApi(
        await window.cleideApi.customerPlans.list({
          search: search.trim() || undefined,
          status,
          page,
          pageSize: 20,
        }),
      ),
  });

  const items = data?.items ?? [];

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header
        title="Planos ativos"
        subtitle="Planos vendidos para cada cliente, com data de vencimento"
        actions={
          <Button onClick={() => navigate('/vendas?nova=1')}>
            <Plus className="h-4 w-4" /> Nova venda
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por cliente ou plano..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as PlanFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="EXPIRING">Vence em breve</SelectItem>
              <SelectItem value="EXPIRED">Vencidos</SelectItem>
              <SelectItem value="CANCELLED">Cancelados</SelectItem>
              <SelectItem value="ALL">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando planos...</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum plano neste filtro"
            description="Venda um plano para um cliente para ativar o prazo."
            actionLabel="Nova venda"
            onAction={() => navigate('/vendas?nova=1')}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Plano</th>
                  <th className="p-3">Duração</th>
                  <th className="p-3">Início</th>
                  <th className="p-3">Vence em</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((plan) => (
                  <tr key={plan.id} className="border-t">
                    <td className="p-3 font-medium">{plan.customerName}</td>
                    <td className="p-3">{plan.productName}</td>
                    <td className="p-3">{formatPlanDuration(plan.durationDays)}</td>
                    <td className="p-3">{new Date(plan.startsAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3">{new Date(plan.expiresAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3">
                      <Badge variant={planBadge(plan.status)}>
                        {CUSTOMER_PLAN_STATUS_LABELS[plan.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {data.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
