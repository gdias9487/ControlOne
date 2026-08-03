/** Cores de gráfico alinhadas aos cards: recebido=verde, fiado=amarelo, despesas=vermelho. */
const BASE = {
  entradas: '#059669',
  saidas: '#E11D48',
  vendas: '#059669',
  faturamento: '#059669',
  fiado: '#D97706',
  lucro: '#059669',
  neutro: '#8A939E',
} as const;

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${hex}${a}`;
}

/** Opacidades de stroke/grid/área (iguais nos dois temas) */
export const CHART_OPACITY = {
  grid: 0.25,
  stroke: 0.9,
  areaStop: 0.28,
  areaFiadoStop: 0.35,
} as const;

/**
 * Soft fills: no dark o fundo escuro “suaviza” a cor;
 * no light usamos alpha um pouco menor para o mesmo visual translúcido.
 */
export function getChartColors(theme: 'light' | 'dark' = 'light') {
  const soft = theme === 'light' ? 0.55 : 0.72;
  const softPrimary = theme === 'light' ? 0.6 : 0.78;
  const softAccent = theme === 'light' ? 0.65 : 0.85;

  return {
    ...BASE,
    entradasSoft: withAlpha(BASE.entradas, soft),
    saidasSoft: withAlpha(BASE.saidas, soft),
    faturamentoSoft: withAlpha(BASE.faturamento, softPrimary),
    fiadoSoft: withAlpha(BASE.fiado, softAccent),
    vendasFill: withAlpha(BASE.vendas, 0.35),
    fiadoFill: withAlpha(BASE.fiado, 0.35),
    lucroFill: withAlpha(BASE.lucro, 0.25),
  } as const;
}

/** @deprecated Prefira getChartColors(theme) — mantido para imports estáticos (stroke/sólidos). */
export const CHART_COLORS = getChartColors('dark');
