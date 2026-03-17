const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

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

async function ensureTenantOwnership(tenantId, ownerId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  return { data, error };
}

async function insertPaymentWithFallback(basePayload) {
  const payload = { ...basePayload };
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;
    const result = await supabase.from('payments').insert(payload).select('*').single();
    if (!result.error) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || typeof payload[missingColumn] === 'undefined') {
      return result;
    }

    console.error(`[payments] Missing "${missingColumn}" column in Supabase table. Retrying insert without it.`, result.error);
    delete payload[missingColumn];
  }

  return { data: null, error: { message: 'Insert retry limit exceeded due schema mismatch.' } };
}

router.get('/tenant/:tenantId', async (req, res) => {
  const tenantId = req.params.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant id.' });
  }

  const { data: tenant, error: tenantError } = await ensureTenantOwnership(tenantId, req.user.id);
  if (tenantError) {
    console.error(tenantError);
    return res.status(500).json({ error: 'Failed to validate tenant ownership.' });
  }
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found.' });
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch payments.' });
  }

  const normalized = (data || []).map((row) => ({
    ...row,
    amount: Number(row.amount ?? 0),
    payment_type: row.payment_type ?? row.type ?? 'Jine',
    note: row.note ?? row.notes ?? '',
  }));

  return res.json(normalized);
});

router.post('/', async (req, res) => {
  const { tenant_id, amount, payment_date, payment_type, note } = req.body || {};

  if (!tenant_id || !payment_date || !Number.isFinite(Number(amount))) {
    return res.status(400).json({ error: 'Fields "tenant_id", "amount" and "payment_date" are required.' });
  }

  const { data: tenant, error: tenantError } = await ensureTenantOwnership(tenant_id, req.user.id);
  if (tenantError) {
    console.error(tenantError);
    return res.status(500).json({ error: 'Failed to validate tenant ownership.' });
  }
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found.' });
  }

  const payload = {
    tenant_id,
    owner_id: req.user.id,
    amount: Number(amount),
    payment_date,
    payment_type: payment_type ?? 'Jine',
    note: note ?? null,
  };

  const { data, error } = await insertPaymentWithFallback(payload);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create payment.', details: error.message });
  }

  return res.status(201).json({
    ...data,
    amount: Number(data?.amount ?? 0),
    payment_type: data?.payment_type ?? data?.type ?? 'Jine',
    note: data?.note ?? data?.notes ?? '',
  });
});

module.exports = router;
