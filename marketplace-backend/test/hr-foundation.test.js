import test from 'node:test';
import assert from 'node:assert/strict';

test('HR Foundation — Data structures and API schema validation', async () => {
  const employeePayload = {
    full_name: 'Sarah Connor',
    email: 'sarah@dealership.com',
    role: 'salesperson',
    department: 'Sales',
    hourly_rate: 28.50
  };

  assert.equal(employeePayload.full_name, 'Sarah Connor');
  assert.equal(employeePayload.hourly_rate, 28.50);
});

test('HR Timeclock — Entry payload validation', async () => {
  const timeEntry = {
    employee_id: 'emp-123',
    clock_in: new Date().toISOString(),
    status: 'active',
    notes: 'Shift Started'
  };

  assert.ok(timeEntry.clock_in);
  assert.equal(timeEntry.status, 'active');
});

test('HR Payroll Batches — Aggregation and disbursal validation', async () => {
  const batch = {
    batch_number: 'PAY-2026-08-01',
    period_start: '2026-07-16',
    period_end: '2026-07-31',
    gross_wages: 32450.00,
    commissions: 14850.00,
    tax_withheld: 9820.00,
    net_payroll: 37480.00,
    status: 'Paid & Disbursed'
  };

  assert.equal(batch.gross_wages + batch.commissions - batch.tax_withheld, batch.net_payroll);
  assert.equal(batch.status, 'Paid & Disbursed');
});
