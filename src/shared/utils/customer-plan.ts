export type CustomerPlanLifeStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CANCELLED';

export const CUSTOMER_PLAN_STATUS_LABELS: Record<CustomerPlanLifeStatus, string> = {
  ACTIVE: 'Ativo',
  EXPIRING: 'Vence em breve',
  EXPIRED: 'Vencido',
  CANCELLED: 'Cancelado',
};

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function customerPlanStatus(
  plan: { expiresAt: Date | string; cancelledAt?: Date | string | null },
  now = new Date(),
  expiringDays = 7,
): CustomerPlanLifeStatus {
  if (plan.cancelledAt) return 'CANCELLED';
  const expires = startOfDay(new Date(plan.expiresAt));
  const today = startOfDay(now);
  if (expires < today) return 'EXPIRED';
  const soon = addDays(today, expiringDays);
  if (expires <= soon) return 'EXPIRING';
  return 'ACTIVE';
}

export function formatPlanDuration(days: number): string {
  if (days === 30) return '1 mês';
  if (days === 90) return '3 meses';
  if (days === 180) return '6 meses';
  if (days === 365) return '1 ano';
  if (days % 30 === 0 && days >= 60 && days <= 330) return `${days / 30} meses`;
  if (days === 1) return '1 dia';
  return `${days} dias`;
}
