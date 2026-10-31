import { APP_NAME } from '@shared/constants';
import { reportSections } from '@shared/report-sections';
import type { ReportDto, SettingsDto } from '@shared/types';
import { formatDateBr } from '@shared/utils/date-range';
import { formatCurrency } from '@/utils';
import { printHtml } from './sale-receipt';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  if (/^\d+\.\d{2}$/.test(value)) return formatCurrency(value);
  return value;
}

function isTotalRow(row: Record<string, string | number>): boolean {
  return Object.values(row).some((value) => String(value).toLowerCase().includes('total'));
}

function isMoneyColumn(rows: Array<Record<string, string | number>>, column: string): boolean {
  return rows.some((row) => typeof row[column] === 'string' && /^\d+\.\d{2}$/.test(row[column]));
}

export function buildReportPrintHtml(report: ReportDto, settings: SettingsDto | null): string {
  const storeName = settings?.storeName?.trim() || APP_NAME;
  const period = `${formatDateBr(report.period.startDate)} até ${formatDateBr(report.period.endDate)}`;
  const sections = reportSections(report);
  const summary = report.summary
    .filter((item) =>
      ['received', 'openFiado', 'costs', 'profit', 'expenses', 'totalAfterExpenses'].includes(
        item.id,
      ),
    )
    .slice(0, 6);

  const summaryHtml = summary
    .map((item) => {
      const value =
        typeof item.value === 'number' ? String(item.value) : formatCurrency(item.value);
      return `<div class="card"><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(value)}</strong></div>`;
    })
    .join('');

  const tables = sections
    .map((section) => {
      const columns = Object.keys(section.rows[0] ?? { Info: '' });
      const moneyCols = new Set(columns.filter((col) => isMoneyColumn(section.rows, col)));
      const head = columns
        .map((col) => `<th${moneyCols.has(col) ? ' class="num"' : ''}>${escapeHtml(col)}</th>`)
        .join('');
      const body =
        section.rows.length > 0
          ? section.rows
              .map((row) => {
                const cells = columns
                  .map((col) => {
                    const cls = moneyCols.has(col) ? ' class="num"' : '';
                    return `<td${cls}>${escapeHtml(formatCell(row[col]))}</td>`;
                  })
                  .join('');
                return `<tr${isTotalRow(row) ? ' class="total"' : ''}>${cells}</tr>`;
              })
              .join('')
          : '<tr><td>Sem dados para o período.</td></tr>';
      return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          <table>
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      background: #fff;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 11px;
    }
    .page { padding: 18px 22px 28px; }
    h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -0.03em; color: #111; }
    h2 {
      margin: 20px 0 8px;
      font-size: 12px;
      font-weight: 700;
      color: #111;
    }
    .muted { color: #6b6b6b; }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #111;
    }
    .cards { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin: 12px 0 8px; }
    .card {
      background: #fff;
      border: 1px solid #e5e5e5;
      padding: 8px 10px;
      min-height: 52px;
    }
    .card span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b6b6b; }
    .card strong { display: block; margin-top: 6px; font-size: 13px; color: #111; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e5e5; padding: 6px 8px; vertical-align: top; }
    th { background: #f5f5f5; text-align: left; font-size: 9px; font-weight: 700; color: #111; }
    .num { text-align: right; white-space: nowrap; }
    tr.total td { background: #f5f5f5; font-weight: 700; color: #111; }
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h2 { break-after: avoid; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div>
        <h1>${escapeHtml(report.title)}</h1>
        <div>${escapeHtml(storeName.toUpperCase())}</div>
        <div class="muted">Período: ${escapeHtml(period)}</div>
      </div>
      <div class="muted" style="text-align:right">
        ${settings?.businessType ? `<div>${escapeHtml(settings.businessType.toUpperCase())}</div>` : ''}
        <div>Gerado em ${escapeHtml(formatDateBr(new Date()))}</div>
      </div>
    </div>
    ${summaryHtml ? `<div class="cards">${summaryHtml}</div>` : ''}
    ${tables || '<p class="muted">Sem dados para o período.</p>'}
  </div>
</body>
</html>`;
}

export function printReport(report: ReportDto, settings: SettingsDto | null): void {
  printHtml(buildReportPrintHtml(report, settings));
}
