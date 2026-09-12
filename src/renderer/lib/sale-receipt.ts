import { APP_NAME, PAYMENT_METHOD_LABELS } from '@shared/constants';
import type { SaleDto, SettingsDto } from '@shared/types';
import { paymentsOfSale, salePaymentsLabel } from '@shared/utils/sale-payments';
import { formatCurrency, formatPercent } from '@/utils';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSaleReceiptHtml(sale: SaleDto, settings: SettingsDto | null): string {
  const storeName = settings?.storeName?.trim() || APP_NAME;
  const phone = settings?.storePhone?.trim() || '';
  const address = settings?.storeAddress?.trim() || '';
  const logo = settings?.logoUrl || '';
  const soldAt = new Date(sale.soldAt).toLocaleString('pt-BR');
  const paymentSplits = paymentsOfSale(sale);
  const payment = salePaymentsLabel(sale);
  const discount = Number(sale.discount);
  const paymentRows = paymentSplits
    .map(
      (split) => `
        <tr>
          <td>${escapeHtml(PAYMENT_METHOD_LABELS[split.method])}</td>
          <td class="num">${escapeHtml(formatCurrency(split.amount))}</td>
        </tr>`,
    )
    .join('');

  const items = sale.items
    .map((item) => {
      const lineDiscount = Number(item.discountPercent);
      return `
        <tr>
          <td>
            ${escapeHtml(item.productName)}
            ${item.productId ? '' : '<div class="muted">Avulso</div>'}
            ${lineDiscount > 0 ? `<div class="muted">Desc. ${escapeHtml(formatPercent(item.discountPercent))}</div>` : ''}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${escapeHtml(formatCurrency(item.unitPrice))}</td>
          <td class="num">${escapeHtml(formatCurrency(item.subtotal))}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Cupom ${escapeHtml(sale.saleNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      background: #fff;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 12px;
    }
    .ticket {
      width: 80mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 8px 10px 16px;
    }
    .center { text-align: center; }
    .logo { width: 48px; height: 48px; object-fit: contain; margin: 0 auto 6px; display: block; }
    h1 { font-size: 15px; margin: 0 0 4px; }
    .muted { color: #555; font-size: 11px; }
    .rule { border: 0; border-top: 1px dashed #999; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 3px 0; vertical-align: top; }
    th { font-size: 10px; text-align: left; color: #555; border-bottom: 1px dashed #999; }
    .num { text-align: right; white-space: nowrap; }
    .totals td { padding-top: 4px; }
    .totals .strong { font-weight: 700; font-size: 14px; }
    .stamp {
      margin-top: 10px;
      padding: 6px;
      border: 1px dashed #999;
      text-align: center;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    @media print {
      @page { size: 80mm auto; margin: 4mm; }
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="" />` : ''}
    <div class="center">
      <h1>${escapeHtml(storeName)}</h1>
      ${address ? `<div class="muted">${escapeHtml(address)}</div>` : ''}
      ${phone ? `<div class="muted">${escapeHtml(phone)}</div>` : ''}
    </div>
    <hr class="rule" />
    <div><strong>Cupom ${escapeHtml(sale.saleNumber)}</strong></div>
    <div class="muted">${escapeHtml(soldAt)}</div>
    <div class="muted">Cliente: ${escapeHtml(sale.customerName ?? 'Não informado')}</div>
    <div class="muted">Pagamento: ${escapeHtml(payment)}</div>
    <hr class="rule" />
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qtd</th>
          <th class="num">Unit.</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
    <hr class="rule" />
    <table class="totals">
      <tr>
        <td>Subtotal</td>
        <td class="num">${escapeHtml(formatCurrency(sale.subtotal))}</td>
      </tr>
      ${
        discount > 0
          ? `<tr><td>Desconto</td><td class="num">−${escapeHtml(formatCurrency(sale.discount))}</td></tr>`
          : ''
      }
      <tr>
        <td class="strong">Total</td>
        <td class="num strong">${escapeHtml(formatCurrency(sale.total))}</td>
      </tr>
      ${paymentRows}
    </table>
    ${sale.notes ? `<p class="muted">Obs.: ${escapeHtml(sale.notes)}</p>` : ''}
    <div class="stamp">Documento não fiscal<br />Não substitui nota fiscal</div>
    <p class="center muted" style="margin-top:10px">Obrigado pela preferência</p>
  </div>
</body>
</html>`;
}

export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 800);
  };

  const trigger = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    cleanup();
  };

  if (iframe.contentDocument?.readyState === 'complete') {
    window.setTimeout(trigger, 150);
  } else {
    iframe.onload = trigger;
  }
}

export function printSaleReceipt(sale: SaleDto, settings: SettingsDto | null): void {
  printHtml(buildSaleReceiptHtml(sale, settings));
}
