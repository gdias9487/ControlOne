import type { PeriodPreset } from '../schemas';

export interface ResolvedDateRange {
  preset: PeriodPreset;
  startDate: Date;
  endDate: Date;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfYear(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), 0, 1));
}

function endOfYear(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), 11, 31));
}

export function resolveDateRange(input: {
  preset?: PeriodPreset;
  startDate?: string;
  endDate?: string;
}): ResolvedDateRange {
  const now = new Date();
  const preset = input.preset ?? 'CURRENT_MONTH';

  switch (preset) {
    case 'TODAY':
      return { preset, startDate: startOfDay(now), endDate: endOfDay(now) };
    case 'LAST_7_DAYS': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { preset, startDate: startOfDay(start), endDate: endOfDay(now) };
    }
    case 'LAST_30_DAYS': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { preset, startDate: startOfDay(start), endDate: endOfDay(now) };
    }
    case 'CURRENT_MONTH':
      return {
        preset,
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
    case 'CURRENT_YEAR':
      return {
        preset,
        startDate: startOfYear(now),
        endDate: endOfYear(now),
      };
    case 'CUSTOM': {
      if (!input.startDate || !input.endDate) {
        throw new Error('Período personalizado exige data inicial e final.');
      }
      return {
        preset,
        startDate: startOfDay(new Date(input.startDate)),
        endDate: endOfDay(new Date(input.endDate)),
      };
    }
    default:
      return {
        preset: 'CURRENT_MONTH',
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
  }
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function formatDateBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR');
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}
