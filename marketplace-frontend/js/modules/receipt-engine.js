/**
 * Receipt Engine — Printable & Saveable Receipts for Parts & Service Work Orders
 *
 * Implements:
 *   1. `printServiceReceipt(roData)` — Generates printable/saveable Customer Service Invoices/Receipts
 *   2. `printPartsReceipt(partsData)` — Generates printable/saveable Parts Invoices/Counter Receipts
 *   3. `logReceiptToCustomerTimeline(contactId, payload)` — Attaches receipt details to CRM Customer Timeline
 */

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rctFmtMoney(v) {
  return v == null ? '$0.00' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Log receipt to CRM Customer Timeline
 */
async function logReceiptToCustomerTimeline(contactId, receiptType, invoiceNo, amount, summaryText) {
  const payload = {
    kind: 'receipt',
    subject: `Printed & Saved ${receiptType} Receipt ${invoiceNo} (${rctFmtMoney(amount)})`,
    body: `Customer receipt ${invoiceNo} generated for ${rctFmtMoney(amount)}. Details: ${summaryText}`,
    timestamp: new Date().toISOString(),
    invoice_no: invoiceNo,
    amount: amount,
    receipt_type: receiptType
  };

  try {
    if (contactId) {
      await apiSendJson(`/crm/contacts/${contactId}/timeline`, 'POST', payload).catch(() => null);
    }
  } catch {
    /* Timeline logging is auxiliary and never blocks receipt printing */
  }
  if (typeof showToast === 'function') {
    showToast(`Receipt ${invoiceNo} logged to customer timeline`, 'success');
  }
}

/**
 * Generate Printable & Saveable Service Work Order / Repair Order Receipt
 */
async function printServiceReceipt(ro) {
  let customer = null;
  if (typeof ro === 'string' || typeof ro === 'number') {
    const roId = ro;
    const res = await apiGetJson(`/service-engine/ros/${roId}`).catch(() => null);
    ro = res?.ro || { id: roId, ro_number: `RO-${roId}`, lines: [] };
    customer = res?.customer || null;
  } else {
    customer = ro.customer || null;
  }

  const notOnFile = 'Not on file';
  const numOrZero = (...vals) => { for (const v of vals) if (v != null && v !== '') return Number(v); return 0; };
  const lines = Array.isArray(ro.lines) ? ro.lines : [];

  const storeName = window.__dealerConfig?.store_name || 'Your Dealership';
  const storePhone = window.__dealerConfig?.phone || notOnFile;
  const storeAddress = window.__dealerConfig?.address || notOnFile;
  const storeTaxId = window.__dealerConfig?.tax_id || '';

  const roNo = ro.ro_number || ro.ro_no || `RO-${ro.id || ''}`;
  const custName = customer?.name || ro.customer_name || ro.name || 'Customer';
  const custPhone = customer?.phone || ro.customer_phone || ro.phone || notOnFile;
  const custEmail = customer?.email || ro.customer_email || ro.email || notOnFile;
  const contactId = customer?.id || ro.contact_id || ro.customer_id || '';

  const veh = ro.vehicle_summary || ro.vehicle_desc || [ro.year, ro.make, ro.model].filter(Boolean).join(' ') || 'Vehicle';
  const vin = ro.vin || notOnFile;
  const mileageIn = ro.odometer != null ? `${Number(ro.odometer).toLocaleString()} mi` : (ro.mileage != null ? `${Number(ro.mileage).toLocaleString()} mi` : notOnFile);
  const fuelIn = ro.fuel_in || notOnFile;
  const advisor = ro.advisor_name || ro.advisor || notOnFile;
  const tech = ro.technician_name || ro.tech || notOnFile;
  const complaint = ro.complaint || null;
  const dateStr = new Date(ro.closed_at || ro.created_at || Date.now()).toLocaleDateString();

  const laborTotal = numOrZero(ro.labor_total);
  const partsTotal = numOrZero(ro.parts_total);
  const subletTotal = numOrZero(ro.sublet_total);
  const feeTotal = numOrZero(ro.fee_total);
  const discount = numOrZero(ro.discount);
  const subtotal = laborTotal + partsTotal + subletTotal + feeTotal - discount;
  const tax = ro.tax != null ? Number(ro.tax) : Math.round(subtotal * 0.13 * 100) / 100;
  const grandTotal = ro.total != null ? Number(ro.total) : subtotal + tax;

  const LINE_TYPE_LABEL = { labor: 'Labor', part: 'Parts', sublet: 'Sublet', fee: 'Fee' };
  const lineRow = (l) => {
    const label = LINE_TYPE_LABEL[l.line_type] || (l.line_type || 'Line');
    const qtyCol = l.line_type === 'labor' && l.hours != null ? `${l.hours} hrs` : `${l.qty ?? 1}`;
    const rateCol = l.line_type === 'labor' ? (l.rate != null ? rctFmtMoney(l.rate) : '—') : (l.unit_price != null ? rctFmtMoney(l.unit_price) : '—');
    return `
      <tr>
        <td><div class="item-title">${escHtml(l.description || label)}</div></td>
        <td>${escHtml(label)}</td>
        <td style="text-align:right">${escHtml(qtyCol)}</td>
        <td style="text-align:right">${rateCol}</td>
        <td style="text-align:right; font-weight:800;">${rctFmtMoney(l.total)}</td>
      </tr>`;
  };
  const itemsHtml = lines.length
    ? lines.map(lineRow).join('')
    : `<tr><td colspan="5" style="color:#94a3b8; font-style:italic; text-align:center; padding:16px 0;">No itemized lines on file for this repair order.</td></tr>`;

  const printWin = window.open('', '_blank', 'width=980,height=1100');
  if (!printWin) {
    if (typeof showToast === 'function') showToast('Please allow pop-ups to print receipts', 'error');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Service Work Order Receipt ${escHtml(roNo)}</title>
      <style>
        @page { size: letter portrait; margin: 0.4in; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0; padding: 0; background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a; font-size: 13px; line-height: 1.5;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        }
        .printbar {
          position: fixed; top: 16px; right: 16px; z-index: 99999;
          background: #ffffff; padding: 10px 16px; border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.08);
          border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 10px;
        }
        .print-btn {
          background: #2563eb; color: #ffffff; border: none; font-size: 13px; font-weight: 800;
          padding: 9px 18px; border-radius: 8px; cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(37,99,235,0.3); transition: all 0.15s ease;
        }
        .print-btn:hover { background: #1d4ed8; }
        .close-btn {
          background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 13px; font-weight: 700;
          padding: 9px 14px; border-radius: 8px; cursor: pointer;
        }
        .close-btn:hover { background: #e2e8f0; }

        .page-wrapper {
          max-width: 820px; margin: 24px auto; background: #ffffff; padding: 36px 40px;
          border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;
        }

        .receipt-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid #0f172a; padding-bottom: 18px; margin-bottom: 20px;
        }
        .store-title { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 2px 0; letter-spacing: -0.5px; }
        .store-sub { font-size: 12px; color: #475569; font-weight: 500; }

        .invoice-badge { text-align: right; }
        .invoice-tag { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; margin-bottom: 2px; }
        .invoice-no { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
        .invoice-date { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px; }
        .status-pill {
          display: inline-block; padding: 3px 10px; background: #dcfce7; color: #15803d;
          border: 1px solid #bbf7d0; border-radius: 9999px; font-size: 10px; font-weight: 900;
          margin-top: 6px; text-transform: uppercase;
        }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .info-card { background: #f8fafc; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .info-card h4 {
          margin: 0 0 8px 0; font-size: 11px; font-weight: 900; text-transform: uppercase;
          color: #64748b; letter-spacing: 0.8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
        }
        .info-card p { margin: 3px 0; font-size: 12.5px; color: #334155; }
        .info-card p strong { color: #0f172a; font-size: 13px; }

        table.items-table {
          width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px;
          border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;
        }
        table.items-table th {
          background: #0f172a !important; color: #ffffff !important; padding: 11px 14px;
          font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.6px; text-align: left;
        }
        table.items-table td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; color: #1e293b; }
        table.items-table tr:nth-child(even) td { background: #f8fafc; }
        table.items-table tr:last-child td { border-bottom: none; }
        .item-title { font-weight: 800; color: #0f172a; font-size: 13px; }
        .item-desc { font-size: 11.5px; color: #475569; margin-top: 3px; line-height: 1.4; }

        .totals-section { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 20px; }
        .signature-card {
          width: 52%; border: 1px dashed #cbd5e1; background: #f8fafc; padding: 16px;
          border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; min-height: 140px;
        }
        .signature-line { border-bottom: 2px solid #64748b; margin-top: 45px; margin-bottom: 6px; }
        .signature-label { font-size: 11px; font-weight: 700; color: #475569; }
        .legal-disclaimer { font-size: 10px; color: #94a3b8; margin-top: 8px; line-height: 1.35; }

        .totals-card { width: 44%; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff; }
        .totals-table { width: 100%; border-collapse: collapse; }
        .totals-table td { padding: 8px 14px; font-size: 12.5px; color: #334155; }
        .totals-table tr.total-row td { border-top: 1px solid #f1f5f9; }
        .totals-table tr.grand-total td { background: #2563eb !important; color: #ffffff !important; font-weight: 900; font-size: 16px; padding: 12px 14px; }

        @media print {
          .printbar { display: none !important; }
          html, body { background: #ffffff !important; padding: 0 !important; }
          .page-wrapper { max-width: 100% !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="printbar">
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        <button class="close-btn" onclick="window.close()">Close Window</button>
      </div>

      <div class="page-wrapper">
        <div class="receipt-header">
          <div>
            <h1 class="store-title">${escHtml(storeName)}</h1>
            <div class="store-sub">${escHtml(storeAddress)} · Ph: ${escHtml(storePhone)}</div>
            <div class="store-sub">${escHtml(storeTaxId)}</div>
          </div>
          <div class="invoice-badge">
            <div class="invoice-tag">Official Service Invoice</div>
            <div class="invoice-no">${escHtml(roNo)}</div>
            <div class="invoice-date">Date: ${escHtml(dateStr)}</div>
            <div class="status-pill">${escHtml(ro.status === 'closed' ? 'Closed' : (ro.status || 'Status unknown'))}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h4>Customer Details</h4>
            <p><strong>${escHtml(custName)}</strong></p>
            <p>Ph: ${escHtml(custPhone)}</p>
            <p>Email: ${escHtml(custEmail)}</p>
          </div>
          <div class="info-card">
            <h4>Vehicle &amp; Work Order Details</h4>
            <p><strong>${escHtml(veh)}</strong></p>
            <p>VIN: <span style="font-family:monospace;font-weight:700;">${escHtml(vin)}</span></p>
            <p>Mileage In: ${escHtml(mileageIn)} · Fuel Level In: ${escHtml(fuelIn)}</p>
            <p>Advisor: ${escHtml(advisor)} · Tech: ${escHtml(tech)}</p>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 45%;">Line Item / Service Performed</th>
              <th style="width: 15%;">Type</th>
              <th style="width: 13%; text-align:right;">Qty / Hrs</th>
              <th style="width: 13%; text-align:right;">Rate</th>
              <th style="width: 14%; text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="signature-card">
            <div>
              <div class="signature-line"></div>
              <div class="signature-label">Customer Signature: X _______________________________________</div>
            </div>
            <div class="legal-disclaimer">I acknowledge receipt of the above services and vehicle in good condition. All work completed according to dealership warranty standards.</div>
          </div>
          <div class="totals-card">
            <table class="totals-table">
              <tr class="total-row">
                <td>Labor Total:</td>
                <td style="text-align:right; font-weight:700;">${rctFmtMoney(laborTotal)}</td>
              </tr>
              <tr class="total-row">
                <td>Parts Total:</td>
                <td style="text-align:right; font-weight:700;">${rctFmtMoney(partsTotal)}</td>
              </tr>
              <tr class="total-row">
                <td>Sublet:</td>
                <td style="text-align:right; font-weight:700;">${rctFmtMoney(subletTotal)}</td>
              </tr>
              <tr class="total-row">
                <td>Fees:</td>
                <td style="text-align:right; font-weight:700;">${rctFmtMoney(feeTotal)}</td>
              </tr>
              ${discount ? `<tr class="total-row"><td>Discount:</td><td style="text-align:right; font-weight:700;">-${rctFmtMoney(discount)}</td></tr>` : ''}
              <tr class="total-row">
                <td>Tax:</td>
                <td style="text-align:right; font-weight:700;">${rctFmtMoney(tax)}</td>
              </tr>
              <tr class="grand-total">
                <td>TOTAL PAID:</td>
                <td style="text-align:right;">${rctFmtMoney(grandTotal)}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();

  // Log to Customer Timeline
  await logReceiptToCustomerTimeline(contactId, 'Service Work Order', roNo, grandTotal, complaint ? `${veh} — ${complaint}` : veh);
}

/**
 * Generate Printable & Saveable Parts Order / Requisition Receipt
 */
async function printPartsReceipt(order) {
  let part = null, customer = null;
  if (typeof order === 'string' || typeof order === 'number') {
    const poId = order;
    const res = await apiGetJson(`/service-engine/part-requests/${poId}`).catch(() => null);
    order = res?.request || { id: poId };
    part = res?.part || null;
    customer = res?.customer || null;
  } else {
    part = order.part || null;
    customer = order.customer || null;
  }

  const notOnFile = 'Not on file';
  const numOrZero = (...vals) => { for (const v of vals) if (v != null && v !== '') return Number(v); return 0; };

  const storeName = window.__dealerConfig?.store_name || 'Your Dealership';
  const storePhone = window.__dealerConfig?.phone || notOnFile;
  const storeAddress = window.__dealerConfig?.address || notOnFile;
  const storeTaxId = window.__dealerConfig?.tax_id || '';

  const poNo = order.order_number || order.po_number || `PO-${order.id || ''}`;
  const custName = customer?.name || order.customer_name || order.account_name || 'Counter Customer / Retail';
  const custPhone = customer?.phone || order.customer_phone || order.phone || notOnFile;
  const contactId = customer?.id || order.contact_id || '';
  const dateStr = new Date(order.requested_at || order.created_at || Date.now()).toLocaleDateString();

  const partNumber = part?.part_number || order.part_number || 'Part';
  const partDesc = part?.description || order.description || '';
  const partBin = part?.bin || order.bin || notOnFile;
  const qty = numOrZero(order.qty_issued, order.qty_requested, order.qty) || 1;
  const unitPrice = numOrZero(part?.price, order.unit_price);
  const partsSubtotal = qty * unitPrice;
  const subtotal = partsSubtotal;
  const tax = order.tax != null ? Number(order.tax) : Math.round(subtotal * 0.13 * 100) / 100;
  const grandTotal = order.total != null ? Number(order.total) : subtotal + tax;

  const printWin = window.open('', '_blank', 'width=980,height=1100');
  if (!printWin) {
    if (typeof showToast === 'function') showToast('Please allow pop-ups to print receipts', 'error');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Parts Order Receipt ${escHtml(poNo)}</title>
      <style>
        @page { size: letter portrait; margin: 0.4in; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0; padding: 0; background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a; font-size: 13px; line-height: 1.5;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        }
        .printbar {
          position: fixed; top: 16px; right: 16px; z-index: 99999;
          background: #ffffff; padding: 10px 16px; border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.08);
          border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 10px;
        }
        .print-btn {
          background: #059669; color: #ffffff; border: none; font-size: 13px; font-weight: 800;
          padding: 9px 18px; border-radius: 8px; cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(5,150,105,0.3); transition: all 0.15s ease;
        }
        .print-btn:hover { background: #047857; }
        .close-btn {
          background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 13px; font-weight: 700;
          padding: 9px 14px; border-radius: 8px; cursor: pointer;
        }
        .close-btn:hover { background: #e2e8f0; }

        .page-wrapper {
          max-width: 820px; margin: 24px auto; background: #ffffff; padding: 36px 40px;
          border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;
        }

        .receipt-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid #0f172a; padding-bottom: 18px; margin-bottom: 20px;
        }
        .store-title { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 2px 0; letter-spacing: -0.5px; }
        .store-sub { font-size: 12px; color: #475569; font-weight: 500; }

        .invoice-badge { text-align: right; }
        .invoice-tag { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #059669; margin-bottom: 2px; }
        .invoice-no { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
        .invoice-date { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px; }
        .status-pill {
          display: inline-block; padding: 3px 10px; background: #dcfce7; color: #15803d;
          border: 1px solid #bbf7d0; border-radius: 9999px; font-size: 10px; font-weight: 900;
          margin-top: 6px; text-transform: uppercase;
        }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .info-card { background: #f8fafc; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .info-card h4 {
          margin: 0 0 8px 0; font-size: 11px; font-weight: 900; text-transform: uppercase;
          color: #64748b; letter-spacing: 0.8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
        }
        .info-card p { margin: 3px 0; font-size: 12.5px; color: #334155; }
        .info-card p strong { color: #0f172a; font-size: 13px; }

        table.items-table {
          width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px;
          border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;
        }
        table.items-table th {
          background: #0f172a !important; color: #ffffff !important; padding: 11px 14px;
          font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.6px; text-align: left;
        }
        table.items-table td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; color: #1e293b; }
        table.items-table tr:nth-child(even) td { background: #f8fafc; }
        table.items-table tr:last-child td { border-bottom: none; }
        .item-title { font-weight: 800; color: #0f172a; font-size: 13px; }
        .item-desc { font-size: 11.5px; color: #475569; margin-top: 3px; line-height: 1.4; }

        .totals-section { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 20px; }
        .signature-card {
          width: 52%; border: 1px dashed #cbd5e1; background: #f8fafc; padding: 16px;
          border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; min-height: 140px;
        }
        .signature-line { border-bottom: 2px solid #64748b; margin-top: 45px; margin-bottom: 6px; }
        .signature-label { font-size: 11px; font-weight: 700; color: #475569; }
        .legal-disclaimer { font-size: 10px; color: #94a3b8; margin-top: 8px; line-height: 1.35; }

        .totals-card { width: 44%; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff; }
        .totals-table { width: 100%; border-collapse: collapse; }
        .totals-table td { padding: 8px 14px; font-size: 12.5px; color: #334155; }
        .totals-table tr.total-row td { border-top: 1px solid #f1f5f9; }
        .totals-table tr.grand-total td { background: #059669 !important; color: #ffffff !important; font-weight: 900; font-size: 16px; padding: 12px 14px; }

        @media print {
          .printbar { display: none !important; }
          html, body { background: #ffffff !important; padding: 0 !important; }
          .page-wrapper { max-width: 100% !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="printbar">
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        <button class="close-btn" onclick="window.close()">Close Window</button>
      </div>

      <div class="page-wrapper">
        <div class="receipt-header">
          <div>
            <h1 class="store-title">${escHtml(storeName)}</h1>
            <div class="store-sub">${escHtml(storeAddress)} · Ph: ${escHtml(storePhone)}</div>
            <div class="store-sub">${escHtml(storeTaxId)}</div>
          </div>
          <div class="invoice-badge">
            <div class="invoice-tag">Parts Counter Invoice</div>
            <div class="invoice-no">${escHtml(poNo)}</div>
            <div class="invoice-date">Date: ${escHtml(dateStr)}</div>
            <div class="status-pill">${escHtml(order.status ? order.status.replace(/_/g, ' ') : 'Status unknown')}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h4>Customer Account</h4>
            <p><strong>${escHtml(custName)}</strong></p>
            <p>Ph: ${escHtml(custPhone)}</p>
          </div>
          <div class="info-card">
            <h4>Order Details</h4>
            <p>Vendor: ${escHtml(order.vendor || notOnFile)}</p>
            <p>Status: ${escHtml(order.status ? order.status.replace(/_/g, ' ') : notOnFile)}</p>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 48%;">Part Number &amp; Description</th>
              <th style="width: 14%;">Bin</th>
              <th style="width: 12%; text-align:right;">Qty</th>
              <th style="width: 13%; text-align:right;">Unit Price</th>
              <th style="width: 13%; text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="item-title">Part # ${escHtml(partNumber)}</div>
                ${partDesc ? `<div class="item-desc">${escHtml(partDesc)}</div>` : ''}
              </td>
              <td>${escHtml(partBin)}</td>
              <td style="text-align:right">${qty}</td>
              <td style="text-align:right">${rctFmtMoney(unitPrice)}</td>
              <td style="text-align:right; font-weight:800;">${rctFmtMoney(partsSubtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals-section">
          <div class="signature-card">
            <div>
              <div class="signature-line"></div>
              <div class="signature-label">Customer Pickup Signature: X _______________________________________</div>
            </div>
            <div class="legal-disclaimer">All parts returns subject to inspection per dealership policy.</div>
          </div>
          <div class="totals-card">
            <table class="totals-table">
              <tr class="total-row">
                <td>Parts Subtotal:</td>
                <td style="text-align:right; font-weight:700;">${rctFmtMoney(partsSubtotal)}</td>
              </tr>
              <tr class="total-row">
                <td>Tax:</td>
                <td style="text-align:right; font-weight:700;">${rctFmtMoney(tax)}</td>
              </tr>
              <tr class="grand-total">
                <td>TOTAL PAID:</td>
                <td style="text-align:right;">${rctFmtMoney(grandTotal)}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();

  // Log to Customer Timeline
  await logReceiptToCustomerTimeline(contactId, 'Parts Order', poNo, grandTotal, partDesc ? `${partNumber} — ${partDesc}` : partNumber);
}

window.printServiceReceipt = printServiceReceipt;
window.printPartsReceipt = printPartsReceipt;
window.logReceiptToCustomerTimeline = logReceiptToCustomerTimeline;
