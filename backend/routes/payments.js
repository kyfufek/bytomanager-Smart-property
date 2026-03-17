const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

async function ensureTenantOwnership(tenantId, ownerId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  return { data, error };
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
  try {
    const body = req.body || {};
    const tenantId = body.tenant_id ?? body.tenantId;
    const rawAmount = body.amount;
    const paymentDate = body.payment_date ?? body.paymentDate ?? body.date;
    const paymentType = body.type ?? body.payment_type ?? body.paymentType ?? 'Jine';
    const note = body.note ?? body.notes ?? null;

    if (!tenantId || !paymentDate || !Number.isFinite(Number(rawAmount))) {
      return res.status(400).json({
        error: 'Fields "tenant_id", "amount" and "payment_date" are required.',
      });
    }

    const { data: tenant, error: tenantError } = await ensureTenantOwnership(tenantId, req.user.id);
    if (tenantError) {
      console.error(tenantError);
      return res.status(500).json({ error: 'Failed to validate tenant ownership.' });
    }
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const payload = {
      tenant_id: tenantId,
      amount: Number(rawAmount),
      payment_date: paymentDate,
      type: paymentType,
      note,
    };

    const { data, error } = await supabase.from('payments').insert(payload).select('*').single();
    if (error) {
      console.error(error);
      const status = error?.code?.startsWith('22') || error?.code?.startsWith('23') ? 400 : 500;
      return res.status(status).json({ error: 'Failed to create payment.', details: error.message });
    }

    return res.status(201).json({
      ...data,
      amount: Number(data?.amount ?? 0),
      payment_type: data?.payment_type ?? data?.type ?? 'Jine',
      note: data?.note ?? data?.notes ?? '',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unexpected server error while creating payment.' });
  }
});

module.exports = router;
