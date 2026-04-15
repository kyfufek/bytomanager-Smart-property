const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

const ALLOWED_STATUSES = ['draft', 'calculated', 'reviewed', 'exported', 'sent'];
const MAX_PERIOD_MONTHS = 12;
const STATUS_STEPS = {
  draft: 0,
  calculated: 1,
  reviewed: 2,
  exported: 3,
  sent: 4,
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidDateInput(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return !Number.isNaN(Date.parse(value));
}

function normalizeDate(value) {
  if (!isValidDateInput(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function countInclusiveMonths(periodFrom, periodTo) {
  const from = new Date(`${periodFrom}T00:00:00.000Z`);
  const to = new Date(`${periodTo}T00:00:00.000Z`);
  return ((to.getUTCFullYear() - from.getUTCFullYear()) * 12)
    + (to.getUTCMonth() - from.getUTCMonth())
    + 1;
}

function validateSettlementPeriod(periodFrom, periodTo) {
  if (!periodFrom || !periodTo) {
    return 'tenant_id, period_from a period_to jsou povinne.';
  }

  if (periodTo < periodFrom) {
    return 'period_to musi byt >= period_from.';
  }

  if (countInclusiveMonths(periodFrom, periodTo) > MAX_PERIOD_MONTHS) {
    return 'Zuctovaci obdobi muze mit maximalne 12 mesicu.';
  }

  return null;
}

function resultTypeFromBalance(balance) {
  const abs = Math.abs(toNumber(balance));
  if (abs < 1) return 'vyrovnano';
  return balance >= 0 ? 'preplatek' : 'nedoplatek';
}

function normalizeItem(item, index) {
  return {
    service_name: String(item?.service_name || item?.name || '').trim(),
    advances_paid: Math.max(0, toNumber(item?.advances_paid)),
    actual_cost: Math.max(0, toNumber(item?.actual_cost)),
    difference: toNumber(item?.advances_paid) - toNumber(item?.actual_cost),
    note: typeof item?.note === 'string' && item.note.trim() ? item.note.trim() : null,
    sort_order: Number.isInteger(item?.sort_order) ? item.sort_order : index,
  };
}

async function ensureTenantAndPropertyOwnership(ownerId, tenantId, propertyId) {
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, owner_id, property_id, full_name')
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (tenantError) return { error: tenantError, tenant: null, propertyId: null };
  if (!tenant) return { error: new Error('Tenant not found.'), tenant: null, propertyId: null };

  const resolvedPropertyId = propertyId || tenant.property_id;
  if (!resolvedPropertyId) {
    return { error: new Error('Tenant does not have assigned property.'), tenant: null, propertyId: null };
  }

  if (tenant.property_id && propertyId && tenant.property_id !== propertyId) {
    return { error: new Error('Selected property does not match tenant property.'), tenant: null, propertyId: null };
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, owner_id, name')
    .eq('id', resolvedPropertyId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (propertyError) return { error: propertyError, tenant: null, propertyId: null };
  if (!property) return { error: new Error('Property not found.'), tenant: null, propertyId: null };

  return { error: null, tenant, propertyId: resolvedPropertyId, property };
}

async function computeAdvancesPaid(ownerId, tenantId, periodFrom, periodTo) {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, status, due_date, paid_date')
    .eq('owner_id', ownerId)
    .eq('tenant_id', tenantId)
    .gte('due_date', periodFrom)
    .lte('due_date', periodTo);

  if (error) throw error;

  return (data || []).reduce((sum, payment) => {
    if (payment.status !== 'paid') return sum;
    return sum + toNumber(payment.amount);
  }, 0);
}

async function fetchSettlementById(ownerId, settlementId) {
  const { data, error } = await supabase
    .from('utility_settlements')
    .select(`
      *,
      tenants:tenant_id (id, full_name),
      properties:property_id (id, name)
    `)
    .eq('id', settlementId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) return { error, data: null };
  if (!data) return { error: null, data: null };

  const { data: items, error: itemsError } = await supabase
    .from('utility_settlement_items')
    .select('*')
    .eq('settlement_id', settlementId)
    .order('sort_order', { ascending: true });

  if (itemsError) return { error: itemsError, data: null };

  return {
    error: null,
    data: {
      ...data,
      tenant_name: data.tenants?.full_name ?? null,
      property_name: data.properties?.name ?? null,
      items: items || [],
    },
  };
}

router.get('/billing/settlements', async (req, res) => {
  const { tenant_id: tenantId, status } = req.query || {};

  let query = supabase
    .from('utility_settlements')
    .select(`
      *,
      tenants:tenant_id (id, full_name),
      properties:property_id (id, name)
    `)
    .eq('owner_id', req.user.id)
    .order('created_at', { ascending: false });

  if (tenantId) query = query.eq('tenant_id', tenantId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch settlements.', details: error.message });

  const normalized = (data || []).map((row) => ({
    ...row,
    tenant_name: row.tenants?.full_name ?? null,
    property_name: row.properties?.name ?? null,
  }));
  return res.json(normalized);
});

router.get('/billing/settlements/:id', async (req, res) => {
  const { id } = req.params;
  const { error, data } = await fetchSettlementById(req.user.id, id);
  if (error) return res.status(500).json({ error: 'Failed to fetch settlement detail.', details: error.message });
  if (!data) return res.status(404).json({ error: 'Settlement not found.' });
  return res.json(data);
});

router.post('/billing/settlements', async (req, res) => {
  try {
    const body = req.body || {};
    const tenantId = body.tenant_id ?? body.tenantId;
    const propertyId = body.property_id ?? body.propertyId ?? null;
    const periodFrom = normalizeDate(body.period_from ?? body.periodFrom);
    const periodTo = normalizeDate(body.period_to ?? body.periodTo);
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    const items = Array.isArray(body.items) ? body.items : [];

    const periodError = validateSettlementPeriod(periodFrom, periodTo);
    if (periodError) {
      return res.status(400).json({ error: periodError });
    }

    const ownership = await ensureTenantAndPropertyOwnership(req.user.id, tenantId, propertyId);
    if (ownership.error) return res.status(400).json({ error: ownership.error.message || 'Invalid tenant/property.' });

    const advancesPaid = await computeAdvancesPaid(req.user.id, tenantId, periodFrom, periodTo);
    const normalizedItems = items.map(normalizeItem).filter((item) => item.service_name);
    const actualCostTotal = normalizedItems.reduce((sum, item) => sum + toNumber(item.actual_cost), 0);
    const balanceTotal = advancesPaid - actualCostTotal;

    const { data: settlement, error: createError } = await supabase
      .from('utility_settlements')
      .insert({
        owner_id: req.user.id,
        tenant_id: tenantId,
        property_id: ownership.propertyId,
        period_from: periodFrom,
        period_to: periodTo,
        title,
        notes,
        status: 'draft',
        advances_total: advancesPaid,
        actual_cost_total: actualCostTotal,
        balance_total: balanceTotal,
        result_type: resultTypeFromBalance(balanceTotal),
      })
      .select('id')
      .single();

    if (createError) return res.status(500).json({ error: 'Failed to create settlement.', details: createError.message });

    if (normalizedItems.length) {
      const { error: itemsError } = await supabase.from('utility_settlement_items').insert(
        normalizedItems.map((item) => ({
          ...item,
          owner_id: req.user.id,
          settlement_id: settlement.id,
        })),
      );
      if (itemsError) return res.status(500).json({ error: 'Failed to create settlement items.', details: itemsError.message });
    }

    const detail = await fetchSettlementById(req.user.id, settlement.id);
    if (detail.error) return res.status(500).json({ error: 'Failed to load created settlement.', details: detail.error.message });
    return res.status(201).json(detail.data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create settlement.', details: error.message });
  }
});

router.put('/billing/settlements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { data: existing, error: existingError } = await fetchSettlementById(req.user.id, id);
    if (existingError) return res.status(500).json({ error: 'Failed to load settlement.', details: existingError.message });
    if (!existing) return res.status(404).json({ error: 'Settlement not found.' });

    const nextStatus = body.status;
    if (nextStatus && !ALLOWED_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid settlement status.' });
    }
    if (nextStatus && STATUS_STEPS[nextStatus] < STATUS_STEPS[existing.status]) {
      return res.status(400).json({ error: 'Status cannot move backwards.' });
    }

    const nextPeriodFrom = body.period_from ? normalizeDate(body.period_from) : existing.period_from;
    const nextPeriodTo = body.period_to ? normalizeDate(body.period_to) : existing.period_to;
    const periodError = validateSettlementPeriod(nextPeriodFrom, nextPeriodTo);
    if (periodError) {
      return res.status(400).json({ error: periodError });
    }

    const normalizedItems = Array.isArray(body.items)
      ? body.items.map(normalizeItem).filter((item) => item.service_name)
      : (existing.items || []).map((item, index) => normalizeItem(item, index)).filter((item) => item.service_name);
    const advancesPaid = await computeAdvancesPaid(req.user.id, existing.tenant_id, nextPeriodFrom, nextPeriodTo);
    const actualCostTotal = normalizedItems.reduce((sum, item) => sum + toNumber(item.actual_cost), 0);
    const balanceTotal = advancesPaid - actualCostTotal;

    const patch = {
      advances_total: advancesPaid,
      actual_cost_total: actualCostTotal,
      balance_total: balanceTotal,
      result_type: resultTypeFromBalance(balanceTotal),
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === 'string') patch.title = body.title.trim() || null;
    if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null;
    if (body.period_from) patch.period_from = nextPeriodFrom;
    if (body.period_to) patch.period_to = nextPeriodTo;
    if (nextStatus) patch.status = nextStatus;
    if (nextStatus === 'calculated') patch.calculated_at = new Date().toISOString();
    if (nextStatus === 'reviewed') patch.reviewed_at = new Date().toISOString();
    if (nextStatus === 'exported') patch.exported_at = new Date().toISOString();
    if (nextStatus === 'sent') patch.sent_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('utility_settlements')
      .update(patch)
      .eq('id', id)
      .eq('owner_id', req.user.id);

    if (updateError) return res.status(500).json({ error: 'Failed to update settlement.', details: updateError.message });

    if (Array.isArray(body.items)) {
      const { error: deleteError } = await supabase
        .from('utility_settlement_items')
        .delete()
        .eq('settlement_id', id)
        .eq('owner_id', req.user.id);
      if (deleteError) return res.status(500).json({ error: 'Failed to replace items.', details: deleteError.message });

      if (normalizedItems.length) {
        const { error: insertError } = await supabase
          .from('utility_settlement_items')
          .insert(normalizedItems.map((item) => ({ ...item, settlement_id: id, owner_id: req.user.id })));
        if (insertError) return res.status(500).json({ error: 'Failed to save items.', details: insertError.message });
      }
    }

    const detail = await fetchSettlementById(req.user.id, id);
    if (detail.error) return res.status(500).json({ error: 'Failed to fetch updated settlement.', details: detail.error.message });
    return res.json(detail.data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update settlement.', details: error.message });
  }
});

router.post('/billing/settlements/:id/calculate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: settlement, error: settlementError } = await fetchSettlementById(req.user.id, id);
    if (settlementError) return res.status(500).json({ error: 'Failed to load settlement.', details: settlementError.message });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found.' });

    const advancesPaid = await computeAdvancesPaid(req.user.id, settlement.tenant_id, settlement.period_from, settlement.period_to);
    const actualCostTotal = (settlement.items || []).reduce((sum, item) => sum + toNumber(item.actual_cost), 0);
    const balanceTotal = advancesPaid - actualCostTotal;

    const { error: updateError } = await supabase
      .from('utility_settlements')
      .update({
        status: STATUS_STEPS[settlement.status] < STATUS_STEPS.calculated ? 'calculated' : settlement.status,
        advances_total: advancesPaid,
        actual_cost_total: actualCostTotal,
        balance_total: balanceTotal,
        result_type: resultTypeFromBalance(balanceTotal),
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', req.user.id);

    if (updateError) return res.status(500).json({ error: 'Failed to calculate settlement.', details: updateError.message });

    const detail = await fetchSettlementById(req.user.id, id);
    if (detail.error) return res.status(500).json({ error: 'Failed to fetch calculated settlement.', details: detail.error.message });
    return res.json(detail.data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to calculate settlement.', details: error.message });
  }
});

module.exports = router;
