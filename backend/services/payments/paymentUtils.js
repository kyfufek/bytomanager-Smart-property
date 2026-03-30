function getMissingColumnName(error) {
  const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const singleQuoted = raw.match(/'([a-zA-Z0-9_]+)'/);
  if (singleQuoted?.[1]) return singleQuoted[1];

  const doubleQuoted = raw.match(/"([a-zA-Z0-9_]+)"/);
  if (doubleQuoted?.[1]) return doubleQuoted[1];

  const columnPattern = raw.match(/column\s+([a-zA-Z0-9_]+)\s+(does not exist|of relation)/i);
  if (columnPattern?.[1]) return columnPattern[1];

  return null;
}

function isValidDateInput(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const simpleDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T/;

  if (!simpleDatePattern.test(trimmed) && !isoDateTimePattern.test(trimmed)) {
    return false;
  }

  const parsed = new Date(trimmed);
  return !Number.isNaN(parsed.getTime());
}

function normalizeDateInput(value) {
  if (!isValidDateInput(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function parseDateAtStartOfDay(value) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  return new Date(`${normalized}T00:00:00.000Z`);
}

function derivePaymentStatus({ dueDate, paidDate }) {
  const normalizedPaidDate = normalizeDateInput(paidDate);
  if (normalizedPaidDate) {
    return 'paid';
  }

  const due = parseDateAtStartOfDay(dueDate);
  if (!due) {
    return 'pending';
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return due < todayUtc ? 'overdue' : 'pending';
}

function normalizePaymentRecord(row = {}) {
  const fallbackDate = row.payment_date ?? null;
  const dueDate = normalizeDateInput(row.due_date ?? fallbackDate);

  let paidDateCandidate = row.paid_date ?? null;
  if (!paidDateCandidate && fallbackDate && !row.due_date) {
    paidDateCandidate = fallbackDate;
  }

  const paidDate = normalizeDateInput(paidDateCandidate);
  const status = derivePaymentStatus({ dueDate, paidDate });

  return {
    id: row.id,
    owner_id: row.owner_id ?? null,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? null,
    amount: Number(row.amount ?? 0),
    due_date: dueDate,
    paid_date: paidDate,
    status,
    note: row.note ?? row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    payment_date: paidDate ?? dueDate,
    payment_type: row.payment_type ?? row.type ?? null,
  };
}

function sortPaymentsNewestFirst(payments = []) {
  return [...payments].sort((a, b) => {
    const aTs = new Date(a.due_date ?? a.created_at ?? 0).getTime();
    const bTs = new Date(b.due_date ?? b.created_at ?? 0).getTime();
    return bTs - aTs;
  });
}

module.exports = {
  derivePaymentStatus,
  getMissingColumnName,
  isValidDateInput,
  normalizeDateInput,
  normalizePaymentRecord,
  sortPaymentsNewestFirst,
};
