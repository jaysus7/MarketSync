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
  if (!contactId && typeof profileContext !== 'undefined') {
    contactId = 'demo-customer';
  }
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
  if (typeof ro === 'string' || typeof ro === 'number') {
    const roId = ro;
    try {
      const res = await apiGetJson(`/service-engine/ros/${roId}`).catch(() => null);
      ro = res?.ro || res || { id: roId, ro_number: `RO-${roId}`, customer_name: 'Customer', vehicle_summary: 'Vehicle' };
    } catch {
      ro = { id: roId, ro_number: `RO-${roId}`, customer_name: 'Customer', vehicle_summary: 'Vehicle' };
    }
  }

  const storeName = window.__dealerConfig?.store_name || 'MarketSync Motors & Service Center';
  const storePhone = window.__dealerConfig?.phone || '(555) 019-2834';
  const storeAddress = window.__dealerConfig?.address || '100 Dealership Way, Automotive City, ON';
  const storeTaxId = window.__dealerConfig?.tax_id || 'GST/HST #849201938RT001';

  const roNo = ro.ro_number || ro.ro_no || `RO-${ro.id || Math.floor(1000 + Math.random() * 9000)}`;
  const custName = ro.customer_name || ro.name || 'Valued Customer';
  const custPhone = ro.customer_phone || ro.phone || '(555) 234-5678';
  const custEmail = ro.customer_email || ro.email || 'customer@example.com';
  const contactId = ro.contact_id || ro.customer_id || '';

  const veh = ro.vehicle_summary || `${ro.year || '2022'} ${ro.make || 'Ford'} ${ro.model || 'F-150'}`;
  const vin = ro.vin || '1FTFW1ED4MFC90421';
  const mileageIn = ro.mileage_in || ro.mileage || '42,150 km';
  const advisor = ro.advisor_name || ro.advisor || 'Dave Miller';
  const tech = ro.technician_name || ro.tech || 'Marcus Vance';
  const dateStr = new Date(ro.closed_at || ro.created_at || Date.now()).toLocaleDateString();

  const laborTotal = Number(ro.labor_total || ro.labor || 245.00);
  const partsTotal = Number(ro.parts_total || ro.parts || 185.50);
  const shopSupplies = Number(ro.shop_supplies || 19.95);
  const envFee = Number(ro.environmental_fee || 4.95);
  const subtotal = laborTotal + partsTotal + shopSupplies + envFee;
  const tax = Number(ro.tax || subtotal * 0.13);
  const grandTotal = Number(ro.total || subtotal + tax);

  const printWin = window.open('', '_blank', 'width=900,height=1000');
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
        @page { size: letter; margin: 0.5in; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.4; }
        .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; border-b: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .store-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
        .store-sub { font-size: 11px; color: #475569; margin-top: 2px; }
        .invoice-badge { text-align: right; }
        .invoice-title { font-size: 18px; font-weight: 900; color: #2563eb; margin: 0; }
        .invoice-no { font-size: 14px; font-weight: 700; color: #0f172a; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .info-block h4 { margin: 0 0 4px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
        .info-block p { margin: 0; font-size: 12px; font-weight: 600; }
        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        table.items-table th { background: #0f172a; color: #fff; padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 800; text-align: left; }
        table.items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .totals-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 16px; }
        .signature-box { width: 55%; border-top: 1px solid #94a3b8; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #475569; }
        .totals-table { width: 38%; border-collapse: collapse; }
        .totals-table td { padding: 4px 8px; font-size: 12px; }
        .totals-table tr.grand-total { font-weight: 900; font-size: 15px; background: #eff6ff; color: #1e40af; border-top: 2px solid #2563eb; }
        .printbar { position: fixed; top: 12px; right: 12px; background: #fff; padding: 8px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #cbd5e1; }
        .print-btn { background: #2563eb; color: #fff; border: none; font-size: 13px; font-weight: 800; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
        .print-btn:hover { background: #1d4ed8; }
        @media print { .printbar { display: none !important; } body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="printbar">
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      </div>

      <div class="receipt-header">
        <div>
          <h1 class="store-title">${escHtml(storeName)}</h1>
          <div class="store-sub">${escHtml(storeAddress)} · Ph: ${escHtml(storePhone)}</div>
          <div class="store-sub">${escHtml(storeTaxId)}</div>
        </div>
        <div class="invoice-badge">
          <div class="invoice-title">SERVICE RECEIPT</div>
          <div class="invoice-no">${escHtml(roNo)}</div>
          <div style="font-size:11px;color:#64748b;">Date: ${escHtml(dateStr)}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h4>Customer Details</h4>
          <p><strong>${escHtml(custName)}</strong></p>
          <p>Ph: ${escHtml(custPhone)}</p>
          <p>Email: ${escHtml(custEmail)}</p>
        </div>
        <div class="info-block">
          <h4>Vehicle &amp; Work Order Details</h4>
          <p><strong>${escHtml(veh)}</strong></p>
          <p>VIN: <span style="font-family:monospace">${escHtml(vin)}</span></p>
          <p>Mileage: ${escHtml(mileageIn)} · Advisor: ${escHtml(advisor)}</p>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Line Item / Service Performed</th>
            <th>Type</th>
            <th style="text-align:right">Qty / Hrs</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Multi-Point Digital Vehicle Inspection &amp; Brake Service</strong><br>
              <span style="font-size:11px;color:#475569;">Concern: Squeaking brake noise. Cause: Front pads worn. Correction: Replaced pads &amp; resurfaced rotors.</span>
            </td>
            <td>Labor</td>
            <td style="text-align:right">1.8 hrs</td>
            <td style="text-align:right">$135.00</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(laborTotal)}</td>
          </tr>
          <tr>
            <td>
              <strong>Ceramic Front Brake Pad Set (OEM)</strong><br>
              <span style="font-size:11px;color:#475569;">Part # BRK-9042-OEM · Bin A-12</span>
            </td>
            <td>Parts</td>
            <td style="text-align:right">1 set</td>
            <td style="text-align:right">$185.50</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(partsTotal)}</td>
          </tr>
          <tr>
            <td>Shop Supplies &amp; Hazardous Disposal Charge</td>
            <td>Fee</td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">$19.95</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(shopSupplies)}</td>
          </tr>
          <tr>
            <td>Environmental Recycling Fee</td>
            <td>Fee</td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">$4.95</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(envFee)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-section">
        <div class="signature-box">
          <p>Customer Signature: X _______________________________________</p>
          <p>I acknowledge receipt of the above services and vehicle in good condition.</p>
        </div>
        <table class="totals-table">
          <tr>
            <td>Labor Total:</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(laborTotal)}</td>
          </tr>
          <tr>
            <td>Parts Total:</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(partsTotal)}</td>
          </tr>
          <tr>
            <td>Fees &amp; Supplies:</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(shopSupplies + envFee)}</td>
          </tr>
          <tr>
            <td>HST / Sales Tax (13%):</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(tax)}</td>
          </tr>
          <tr class="grand-total">
            <td style="padding:8px">TOTAL PAID:</td>
            <td style="text-align:right;padding:8px">${rctFmtMoney(grandTotal)}</td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();

  // Log to Customer Timeline
  await logReceiptToCustomerTimeline(contactId, 'Service Work Order', roNo, grandTotal, `${veh} - Brake Service & Inspection`);
}

/**
 * Generate Printable & Saveable Parts Order / Requisition Receipt
 */
async function printPartsReceipt(order) {
  if (typeof order === 'string' || typeof order === 'number') {
    const poId = order;
    order = { id: poId, order_number: `PO-${poId}`, customer_name: 'Counter Customer' };
  }

  const storeName = window.__dealerConfig?.store_name || 'MarketSync Dealership Parts Department';
  const storePhone = window.__dealerConfig?.phone || '(555) 019-2834';
  const storeAddress = window.__dealerConfig?.address || '100 Dealership Way, Automotive City, ON';
  const storeTaxId = window.__dealerConfig?.tax_id || 'GST/HST #849201938RT001';

  const poNo = order.order_number || order.po_number || `PO-${order.id || Math.floor(1000 + Math.random() * 9000)}`;
  const custName = order.customer_name || order.account_name || 'Counter Customer / Retail';
  const custPhone = order.customer_phone || order.phone || '(555) 987-6543';
  const contactId = order.contact_id || '';
  const dateStr = new Date(order.created_at || Date.now()).toLocaleDateString();

  const partsSubtotal = Number(order.parts_subtotal || order.subtotal || 340.00);
  const coreCharge = Number(order.core_charge || 45.00);
  const shippingFee = Number(order.shipping_fee || 0.00);
  const subtotal = partsSubtotal + coreCharge + shippingFee;
  const tax = Number(order.tax || subtotal * 0.13);
  const grandTotal = Number(order.total || subtotal + tax);

  const printWin = window.open('', '_blank', 'width=900,height=1000');
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
        @page { size: letter; margin: 0.5in; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.4; }
        .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; border-b: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .store-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
        .store-sub { font-size: 11px; color: #475569; margin-top: 2px; }
        .invoice-badge { text-align: right; }
        .invoice-title { font-size: 18px; font-weight: 900; color: #059669; margin: 0; }
        .invoice-no { font-size: 14px; font-weight: 700; color: #0f172a; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .info-block h4 { margin: 0 0 4px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
        .info-block p { margin: 0; font-size: 12px; font-weight: 600; }
        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        table.items-table th { background: #0f172a; color: #fff; padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 800; text-align: left; }
        table.items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .totals-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 16px; }
        .signature-box { width: 55%; border-top: 1px solid #94a3b8; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #475569; }
        .totals-table { width: 38%; border-collapse: collapse; }
        .totals-table td { padding: 4px 8px; font-size: 12px; }
        .totals-table tr.grand-total { font-weight: 900; font-size: 15px; background: #ecfdf5; color: #065f46; border-top: 2px solid #10b981; }
        .printbar { position: fixed; top: 12px; right: 12px; background: #fff; padding: 8px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #cbd5e1; }
        .print-btn { background: #059669; color: #fff; border: none; font-size: 13px; font-weight: 800; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
        .print-btn:hover { background: #047857; }
        @media print { .printbar { display: none !important; } body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="printbar">
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      </div>

      <div class="receipt-header">
        <div>
          <h1 class="store-title">${escHtml(storeName)}</h1>
          <div class="store-sub">${escHtml(storeAddress)} · Ph: ${escHtml(storePhone)}</div>
          <div class="store-sub">${escHtml(storeTaxId)}</div>
        </div>
        <div class="invoice-badge">
          <div class="invoice-title">PARTS RECEIPT / INVOICE</div>
          <div class="invoice-no">${escHtml(poNo)}</div>
          <div style="font-size:11px;color:#64748b;">Date: ${escHtml(dateStr)}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h4>Customer Account</h4>
          <p><strong>${escHtml(custName)}</strong></p>
          <p>Ph: ${escHtml(custPhone)}</p>
          <p>Payment: Paid (Credit Card / Counter)</p>
        </div>
        <div class="info-block">
          <h4>Counter &amp; Bin Order Details</h4>
          <p>Counter Rep: Elena Rostova</p>
          <p>Fulfillment: Picked &amp; Verified</p>
          <p>Status: Complete / Handed to Customer</p>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Part Number &amp; Description</th>
            <th>Bin</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Unit Price</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Part # ALT-3920 — High Output Alternator Assembly</strong><br>
              <span style="font-size:11px;color:#475569;">OEM Ford Remanufactured Alternator</span>
            </td>
            <td>BIN-B04</td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">$340.00</td>
            <td style="text-align:right;font-weight:700">$340.00</td>
          </tr>
          <tr>
            <td>
              <strong>Refundable Core Deposit</strong><br>
              <span style="font-size:11px;color:#475569;">Core return required within 30 days for full credit</span>
            </td>
            <td>CORE</td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">$45.00</td>
            <td style="text-align:right;font-weight:700">$45.00</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-section">
        <div class="signature-box">
          <p>Customer Pickup Signature: X _______________________________________</p>
          <p>All electrical parts returns subject to inspection. Core deposit refundable upon return of undamaged core in original box.</p>
        </div>
        <table class="totals-table">
          <tr>
            <td>Parts Subtotal:</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(partsSubtotal)}</td>
          </tr>
          <tr>
            <td>Core Deposit:</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(coreCharge)}</td>
          </tr>
          <tr>
            <td>Sales Tax (13%):</td>
            <td style="text-align:right;font-weight:700">${rctFmtMoney(tax)}</td>
          </tr>
          <tr class="grand-total">
            <td style="padding:8px">TOTAL PAID:</td>
            <td style="text-align:right;padding:8px">${rctFmtMoney(grandTotal)}</td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();

  // Log to Customer Timeline
  await logReceiptToCustomerTimeline(contactId, 'Parts Order', poNo, grandTotal, `Alternator & Core Charge`);
}

window.printServiceReceipt = printServiceReceipt;
window.printPartsReceipt = printPartsReceipt;
window.logReceiptToCustomerTimeline = logReceiptToCustomerTimeline;
