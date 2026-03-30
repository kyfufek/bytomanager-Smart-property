const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');
const {
  getMissingColumnName,
  normalizePaymentRecord,
  sortPaymentsNewestFirst,
} = require('../services/payments/paymentUtils');

const router = express.Router();

router.use(requireAuth);

async function fetchPaymentMapByTenant(ownerId, tenantIds) {
  if (!tenantIds.length) {
    return { data: new Map(), error: null };
  }

  const byOwner = await supabase
    .from('payments')
    .select('*')
    .eq('owner_id', ownerId)
    .in('tenant_id', tenantIds);

  let rows = byOwner.data;
  let error = byOwner.error;

  if (error) {
    const missingColumn = getMissingColumnName(error);
    if (missingColumn !== 'owner_id') {
      return { data: null, error };
    }

    const fallback = await supabase
      .from('payments')
      .select('*')
      .in('tenant_id', tenantIds);

    rows = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return { data: null, error };
  }

  const normalized = sortPaymentsNewestFirst((rows || []).map(normalizePaymentRecord));
  const map = new Map();
  for (const payment of normalized) {
    if (!payment.tenant_id) continue;
    if (!map.has(payment.tenant_id)) {
      map.set(payment.tenant_id, payment);
    }
  }

  return { data: map, error: null };
}

router.get('/tenants', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*, properties(name, rent)')
    .eq('owner_id', req.user.id);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch tenants.' });
  }

  const tenants = data || [];
  const tenantIds = tenants.map((row) => row.id);

  const { data: latestPaymentByTenant, error: paymentError } = await fetchPaymentMapByTenant(req.user.id, tenantIds);
  if (paymentError) {
    console.warn('[tenants] payment summary unavailable, falling back to empty status map', paymentError.message);
  }
  const paymentMap = latestPaymentByTenant || new Map();

  const normalized = tenants.map((row) => {
    const latestPayment = paymentMap.get(row.id) || null;
    const latestPaymentStatus = latestPayment?.status ?? null;
    const latestPaymentAmount = Number(latestPayment?.amount ?? 0);

    return {
      ...row,
      // Frontend currently expects these keys.
      name: row.name ?? row.full_name,
      apartment: row.apartment ?? row.properties?.name ?? null,
      property_rent: Number(row.property_rent ?? row.properties?.rent ?? 0),
      deposit: Number(row.deposit ?? 0),
      currentDebt: Number(row.currentDebt ?? row.current_debt ?? 0),
      payment_status: latestPaymentStatus ?? 'none',
      payment_due_date: latestPayment?.due_date ?? null,
      payment_paid_date: latestPayment?.paid_date ?? null,
      payment_amount_paid: latestPaymentStatus === 'paid' ? latestPaymentAmount : 0,
      payment_amount_due: latestPaymentStatus === 'paid' ? 0 : latestPaymentAmount,
      has_payment_history: Boolean(latestPayment),
    };
  });

  return res.json(normalized);
});

router.get('/tenants/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('tenants')
    .select('*, properties(name, rent)')
    .eq('id', id)
    .eq('owner_id', req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch tenant detail.' });
  }

  if (!data) {
    return res.status(404).json({ error: 'Tenant not found.' });
  }

  const { data: latestPaymentByTenant, error: paymentError } = await fetchPaymentMapByTenant(req.user.id, [id]);
  if (paymentError) {
    console.warn('[tenants] payment summary unavailable for tenant detail', paymentError.message);
  }
  const latestPayment = (latestPaymentByTenant || new Map()).get(id) || null;
  const latestPaymentStatus = latestPayment?.status ?? null;
  const latestPaymentAmount = Number(latestPayment?.amount ?? 0);

  return res.json({
    ...data,
    name: data?.name ?? data?.full_name,
    apartment: data?.apartment ?? data?.properties?.name ?? null,
    property_rent: Number(data?.property_rent ?? data?.properties?.rent ?? 0),
    deposit: Number(data?.deposit ?? 0),
    currentDebt: Number(data?.currentDebt ?? data?.current_debt ?? 0),
    payment_status: latestPaymentStatus ?? 'none',
    payment_due_date: latestPayment?.due_date ?? null,
    payment_paid_date: latestPayment?.paid_date ?? null,
    payment_amount_paid: latestPaymentStatus === 'paid' ? latestPaymentAmount : 0,
    payment_amount_due: latestPaymentStatus === 'paid' ? 0 : latestPaymentAmount,
    has_payment_history: Boolean(latestPayment),
  });
});

router.post('/tenants', async (req, res) => {
  const {
    name,
    full_name,
    property_id,
    email,
    phone,
    lease_start,
    lease_end,
    monthly_rent,
    notes,
  } = req.body || {};

  const resolvedFullName = full_name ?? name;
  if (!resolvedFullName || !property_id) {
    return res.status(400).json({ error: 'Fields "full_name" (or "name") and "property_id" are required.' });
  }

  const { data: ownedProperty, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', property_id)
    .eq('owner_id', req.user.id)
    .maybeSingle();

  if (propertyError) {
    return res.status(500).json({ error: 'Failed to validate property ownership.' });
  }

  if (!ownedProperty) {
    return res.status(403).json({ error: 'You do not have access to the selected property.' });
  }

  const payload = {
    full_name: resolvedFullName,
    property_id,
    email: email ?? null,
    phone: phone ?? null,
    lease_start: lease_start ?? null,
    lease_end: lease_end ?? null,
    monthly_rent: monthly_rent ?? null,
    notes: notes ?? null,
    owner_id: req.user.id,
  };

  const { data, error } = await supabase
    .from('tenants')
    .insert(payload)
    .select('*, properties(name, rent)')
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to create tenant.' });
  }

  return res.status(201).json({
    ...data,
    name: data?.name ?? data?.full_name,
    apartment: data?.apartment ?? data?.properties?.name ?? null,
    property_rent: Number(data?.property_rent ?? data?.properties?.rent ?? 0),
    deposit: Number(data?.deposit ?? 0),
    currentDebt: Number(data?.currentDebt ?? data?.current_debt ?? 0),
    payment_status: 'none',
    payment_due_date: null,
    payment_paid_date: null,
    payment_amount_paid: 0,
    payment_amount_due: 0,
    has_payment_history: false,
  });
});

router.delete('/tenants/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', id)
    .eq('owner_id', req.user.id)
    .select('id');

  if (error) {
    return res.status(500).json({ error: 'Failed to delete tenant.' });
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Tenant not found.' });
  }

  return res.status(204).send();
});

module.exports = router;
