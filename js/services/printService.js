// ============================================
// LIKHĀ CAFÉ - PRINT SERVICE
// Branded receipt printing
// ============================================

import storeData from '../data/storeData.js';

class PrintService {
  constructor() {
    this.printFrame = null;
  }

  // Generate receipt HTML
  generateReceiptHTML(order) {
    const store = storeData;
    const createdAt = order.createdAt instanceof Date 
      ? order.createdAt 
      : new Date(order.createdAt);
    
    const dateStr = createdAt.toLocaleDateString('en-PH', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    });
    const timeStr = createdAt.toLocaleTimeString('en-PH', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const itemsHTML = order.items.map(item => {
      let details = [];
      if (item.size) details.push(item.size);
      if (item.flavor) details.push(item.flavor);
      if (item.eggOption) details.push(item.eggOption);
      if (item.customization) {
        if (item.customization.milk) details.push(item.customization.milk);
        if (item.customization.sugar) details.push(item.customization.sugar + ' sugar');
      }
      const detailStr = details.length > 0 ? `<div class="receipt-item-detail">${details.join(' · ')}</div>` : '';
      
      return `
        <div class="receipt-item">
          <div class="receipt-item-left">
            <span class="receipt-item-name">${item.name}</span>
            ${detailStr}
          </div>
          <span class="receipt-item-qty">×${item.qty}</span>
          <span class="receipt-item-price">${store.currency}${(item.price * item.qty).toFixed(2)}</span>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${order.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            padding: 8mm;
            font-size: 10pt;
            color: #000;
            background: #fff;
          }
          .receipt-center { text-align: center; }
          .receipt-store-name {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .receipt-tagline {
            font-size: 8pt;
            margin-bottom: 2px;
            color: #555;
          }
          .receipt-info {
            font-size: 8pt;
            color: #555;
          }
          .receipt-divider {
            border: none;
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .receipt-meta {
            font-size: 9pt;
            margin: 2px 0;
          }
          .receipt-meta span { font-weight: bold; }
          .receipt-item {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin: 4px 0;
            font-size: 9pt;
          }
          .receipt-item-left { flex: 1; }
          .receipt-item-name { font-weight: bold; }
          .receipt-item-detail {
            font-size: 7pt;
            color: #666;
            font-style: italic;
          }
          .receipt-item-qty {
            width: 30px;
            text-align: center;
          }
          .receipt-item-price {
            width: 65px;
            text-align: right;
          }
          .receipt-total-row {
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            margin: 2px 0;
          }
          .receipt-total-row.grand-total {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 2px solid #000;
          }
          .receipt-footer {
            text-align: center;
            margin-top: 8px;
            font-size: 8pt;
            color: #555;
          }
          .receipt-footer .thank-you {
            font-size: 10pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 4px;
          }
          .receipt-footer .motto {
            font-style: italic;
            margin: 4px 0;
          }
          .receipt-footer .social {
            font-weight: bold;
            color: #000;
            margin-top: 4px;
          }
          @media print {
            body { width: 80mm; padding: 4mm; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-center">
          <div class="receipt-store-name">☕ ${store.receipt.header}</div>
          <div class="receipt-tagline">${store.receipt.tagline}</div>
          <div class="receipt-info">${store.location}</div>
          <div class="receipt-info">📞 ${store.contact}</div>
        </div>

        <hr class="receipt-divider">

        <div class="receipt-meta">Order #: <span>${order.orderNumber}</span></div>
        <div class="receipt-meta">Date: <span>${dateStr} ${timeStr}</span></div>
        <div class="receipt-meta">Staff: <span>${order.staff?.name || 'Staff'}</span></div>
        <div class="receipt-meta">Type: <span>${order.orderType}${order.tableNumber ? ' — Table ' + order.tableNumber : ''}</span></div>
        ${order.customer?.name && order.customer.name !== 'Walk-in' ? `<div class="receipt-meta">Customer: <span>${order.customer.name}</span></div>` : ''}

        <hr class="receipt-divider">

        ${itemsHTML}

        <hr class="receipt-divider">

        <div class="receipt-total-row">
          <span>Subtotal</span>
          <span>${store.currency}${order.subtotal?.toFixed(2) || '0.00'}</span>
        </div>
        ${order.tax > 0 ? `
        <div class="receipt-total-row">
          <span>VAT (${(store.taxRate ? store.taxRate * 100 : 12).toFixed(0)}% Included)</span>
          <span>${store.currency}${order.tax?.toFixed(2) || '0.00'}</span>
        </div>
        ` : ''}
        ${order.takeoutTax > 0 ? `
        <div class="receipt-total-row">
          <span>Takeout Tax (5%)</span>
          <span>${store.currency}${order.takeoutTax.toFixed(2)}</span>
        </div>
        ` : ''}
        ${order.discount?.amount > 0 ? `
        <div class="receipt-total-row">
          <span>Discount${order.discount.type === 'percentage' ? ` (${order.discount.value}%)` : ''}</span>
          <span>-${store.currency}${order.discount.amount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="receipt-total-row grand-total">
          <span>TOTAL</span>
          <span>${store.currency}${order.total?.toFixed(2) || '0.00'}</span>
        </div>

        <hr class="receipt-divider">

        <div class="receipt-total-row">
          <span>Payment</span>
          <span>${order.payment?.type || 'Cash'}</span>
        </div>
        <div class="receipt-total-row">
          <span>Amount</span>
          <span>${store.currency}${order.payment?.amount?.toFixed(2) || '0.00'}</span>
        </div>
        <div class="receipt-total-row">
          <span>Change</span>
          <span>${store.currency}${order.payment?.change?.toFixed(2) || '0.00'}</span>
        </div>

        <hr class="receipt-divider">

        <div class="receipt-footer">
          <div class="thank-you">${store.receipt.thankYou}</div>
          <div class="motto">${store.receipt.footer}</div>
          <div class="social">${store.receipt.social}</div>
        </div>
      </body>
      </html>
    `;
  }

  // Print receipt using hidden iframe
  printReceipt(order) {
    const html = this.generateReceiptHTML(order);
    
    // Remove existing print frame
    if (this.printFrame) {
      document.body.removeChild(this.printFrame);
    }

    // Create hidden iframe for printing
    this.printFrame = document.createElement('iframe');
    this.printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;';
    document.body.appendChild(this.printFrame);

    const frameDoc = this.printFrame.contentDocument || this.printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    // Wait for content to load, then print
    this.printFrame.onload = () => {
      setTimeout(() => {
        this.printFrame.contentWindow.print();
      }, 250);
    };
  }

  // Preview receipt (returns HTML string)
  previewReceipt(order) {
    return this.generateReceiptHTML(order);
  }
}

export default PrintService;
