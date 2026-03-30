const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');
const {
  derivePaymentStatus,
  getMissingColumnName,
  isValidDateInput,
  normalizeDateInput,
  normalizePaymentRecord,
  sortPaymentsNewestFirst,
} = require('../services/payments/paymentUtils');

const router = express.Router();

router.use(requireAuth);

async function ensureTenantOwnership(tenantId, ownerId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, property_id')
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  return { data, error };
}

async function ensurePropertyOwnership(propertyId, ownerId) {
  if (!propertyId) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  return { data, error };
}

async function fetchOwnedTenantIds(ownerId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', ownerId);

  if (error) {
    return { data: null, error };
  }

  return { data: (data || []).map((item) => item.id), error: null };
}

async function listPaymentsForOwner(ownerId) {
  const byOwner = await supabase
    .from('payments')
    .select('*')
    .eq('owner_id', ownerId);

  if (!byOwner.error) {
    return byOwner;
  }

  const missingColumn = getMissingColumnName(byOwner.error);
  if (missingColumn !== 'owner_id') {
    return byOwner;
  }

  const { data: tenantIds, error: tenantError } = await fetchOwnedTenantIds(ownerId);
  if (tenantError) {
    return { data: null, error: tenantError };
  }

  if (!tenantIds || tenantIds.length === 0) {
    return { data: [], error: null };
  }

  return supabase.from('payments').select('*').in('tenant_id', tenantIds);
}

async function findOwnedPayment(paymentId, ownerId) {
  const byOwner = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (!byOwner.error) {
    return byOwner;
  }

  const missingColumn = getMissingColumnName(byOwner.error);
  if (missingColumn !== 'owner_id') {
    return byOwner;
  }

  const byId = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (byId.error || !byId.data) {
    return byId;
  }

  const { data: tenant, error: tenantError } = await ensureTenantOwnership(byId.data.tenant_id, ownerId);
  if (tenantError) {
    return { data: null, error: tenantError };
  }

  if (!tenant) {
    return { data: null, error: null };
  }

  return byId;
}

async function insertPaymentWithFallback(basePayload) {
  const payload = { ...basePayload };
  let attempts = 0;

  while (attempts < 12) {
    attempts += 1;
    const result = await supabase.from('payments').insert(payload).select('*').single();
    if (!result.error) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || typeof payload[missingColumn] === 'undefined') {
      return result;
    }

    delete payload[missingColumn];
  }

  return { data: null, error: { message: 'Insert retry limit exceeded due schema mismatch.' } };
}

async function updatePaymentWithFallback(paymentId, ownerId, basePayload) {
  const payload = { ...basePayload };
  let attempts = 0;

  while (attempts < 12) {
    attempts += 1;
    const result = await supabase
      .from('payments')
      .update(payload)
      .eq('id', paymentId)
      .eq('owner_id', ownerId)
      .select('*')
      .maybeSingle();

    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingColumnName(result.error);
    if (missingColumn === 'owner_id') {
      const fallbackResult = await supabase
        .from('payments')
        .update(payload)
        .eq('id', paymentId)
        .select('*')
        .maybeSingle();

      if (!fallbackResult.error) {
        const { data: tenant, error: tenantError } = await ensureTenantOwnership(fallbackResult.data?.tenant_id, ownerId);
        if (tenantError) {
          return { data: null, error: tenantError };
        }

        if (!tenant) {
          return { data: null, error: null };
        }
      }

      return fallbackResult;
    }

    if (!missingColumn || typeof payload[missingColumn] === 'undefined') {
      return result;
    }

    delete payload[missingColumn];
  }

  return { data: null, error: { message: 'Update retry limit exceeded due schema mismatch.' } };
}

router.get('/', async (req, res) => {
  const { data, error } = await listPaymentsForOwner(req.user.id);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch payments.' });
  }

  const normalized = sortPaymentsNewestFirst((data || []).map(normalizePaymentRecord));
  return res.json(normalized);
});

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
    .eq('tenant_id', tenantId);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch payments.' });
  }

  const normalized = sortPaymentsNewestFirst((data || []).map(normalizePaymentRecord));
  return res.json(normalized);
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const tenantId = body.tenant_id ?? body.tenantId;
    const rawAmount = Number(body.amount);
    const dueDateRaw = body.due_date ?? body.dueDate ?? body.payment_date ?? body.paymentDate;
    const paidDateRaw = body.paid_date ?? body.paidDate ?? null;
    const note = typeof body.note === 'string' ? body.note.trim() : body.note ?? null;

    if (!tenantId) {
      return res.status(400).json({ error: 'Field "tenant_id" is required.' });
    }

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return res.status(400).json({ error: 'Field "amount" must be a number greater than 0.' });
    }

    if (!isValidDateInput(dueDateRaw)) {
      return res.status(400).json({ error: 'Field "due_date" must be a valid date.' });
    }

    if (paidDateRaw && !isValidDateInput(paidDateRaw)) {
      return res.status(400).json({ error: 'Field "paid_date" must be a valid date when provided.' });
    }

    const dueDate = normalizeDateInput(dueDateRaw);
    const paidDate = normalizeDateInput(paidDateRaw);

    const { data: tenant, error: tenantError } = await ensureTenantOwnership(tenantId, req.user.id);
    if (tenantError) {
      console.error(tenantError);
      return res.status(500).json({ error: 'Failed to validate tenant ownership.' });
    }
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const requestedPropertyId = body.property_id ?? body.propertyId ?? null;
    const resolvedPropertyId = requestedPropertyId ?? tenant.property_id ?? null;

    if (requestedPropertyId && tenant.property_id && requestedPropertyId !== tenant.property_id) {
      return res.status(400).json({ error: 'Selected property does not match tenant property.' });
    }

    if (resolvedPropertyId) {
      const { data: property, error: propertyError } = await ensurePropertyOwnership(resolvedPropertyId, req.user.id);
      if (propertyError) {
        console.error(propertyError);
        return res.status(500).json({ error: 'Failed to validate property ownership.' });
      }
      if (!property) {
        return res.status(403).json({ error: 'You do not have access to the selected property.' });
      }
    }

    const status = derivePaymentStatus({ dueDate, paidDate });
    const payload = {
      owner_id: req.user.id,
      tenant_id: tenantId,
      property_id: resolvedPropertyId,
      amount: rawAmount,
      due_date: dueDate,
      paid_date: paidDate,
      status,
      note: note || null,
      payment_date: paidDate ?? dueDate,
      type: body.payment_type ?? body.type ?? null,
      payment_type: body.payment_type ?? body.type ?? null,
    };

    const { data, error } = await insertPaymentWithFallback(payload);
    if (error) {
      console.error(error);
      const statusCode = error?.code?.startsWith('22') || error?.code?.startsWith('23') ? 400 : 500;
      return res.status(statusCode).json({ error: 'Failed to create payment.', details: error.message });
    }

    return res.status(201).json(normalizePaymentRecord(data));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unexpected server error while creating payment.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const paymentId = req.params.id;
    if (!paymentId) {
      return res.status(400).json({ error: 'Missing payment id.' });
    }

    const { data: existing, error: existingError } = await findOwnedPayment(paymentId, req.user.id);
    if (existingError) {
      console.error(existingError);
      return res.status(500).json({ error: 'Failed to load payment.' });
    }

    if (!existing) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const body = req.body || {};
    const hasAmount = Object.prototype.hasOwnProperty.call(body, 'amount');
    const hasDueDate = Object.prototype.hasOwnProperty.call(body, 'due_date') || Object.prototype.hasOwnProperty.call(body, 'dueDate');
    const hasPaidDate = Object.prototype.hasOwnProperty.call(body, 'paid_date') || Object.prototype.hasOwnProperty.call(body, 'paidDate');
    const hasTenantId = Object.prototype.hasOwnProperty.call(body, 'tenant_id') || Object.prototype.hasOwnProperty.call(body, 'tenantId');
    const hasPropertyId = Object.prototype.hasOwnProperty.call(body, 'property_id') || Object.prototype.hasOwnProperty.call(body, 'propertyId');
    const hasNote = Object.prototype.hasOwnProperty.call(body, 'note');
    const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');

    if (!hasAmount && !hasDueDate && !hasPaidDate && !hasTenantId && !hasPropertyId && !hasNote && !hasStatus) {
      return res.status(400).json({ error: 'No updatable fields were provided.' });
    }

    const nextAmount = hasAmount ? Number(body.amount) : Number(existing.amount ?? 0);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return res.status(400).json({ error: 'Field "amount" must be a number greater than 0.' });
    }

    const nextTenantId = hasTenantId ? body.tenant_id ?? body.tenantId : existing.tenant_id;
    const { data: tenant, error: tenantError } = await ensureTenantOwnership(nextTenantId, req.user.id);
    if (tenantError) {
      console.error(tenantError);
      return res.status(500).json({ error: 'Failed to validate tenant ownership.' });
    }
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const dueDateRaw = hasDueDate
      ? body.due_date ?? body.dueDate
      : existing.due_date ?? existing.payment_date;

    if (!isValidDateInput(dueDateRaw)) {
      return res.status(400).json({ error: 'Field "due_date" must be a valid date.' });
    }

    const dueDate = normalizeDateInput(dueDateRaw);

    let paidDateRaw = hasPaidDate
      ? body.paid_date ?? body.paidDate
      : existing.paid_date;

    if (!paidDateRaw && hasStatus && body.status === 'paid') {
      paidDateRaw = new Date().toISOString().slice(0, 10);
    }

    if (hasPaidDate && paidDateRaw && !isValidDateInput(paidDateRaw)) {
      return res.status(400).json({ error: 'Field "paid_date" must be a valid date when provided.' });
    }

    const paidDate = normalizeDateInput(paidDateRaw);

    const requestedPropertyId = hasPropertyId
      ? body.property_id ?? body.propertyId
      : existing.property_id ?? tenant.property_id ?? null;

    const resolvedPropertyId = requestedPropertyId ?? tenant.property_id ?? null;

    if (requestedPropertyId && tenant.property_id && requestedPropertyId !== tenant.property_id) {
      return res.status(400).json({ error: 'Selected property does not match tenant property.' });
    }

    if (resolvedPropertyId) {
      const { data: property, error: propertyError } = await ensurePropertyOwnership(resolvedPropertyId, req.user.id);
      if (propertyError) {
        console.error(propertyError);
        return res.status(500).json({ error: 'Failed to validate property ownership.' });
      }
      if (!property) {
        return res.status(403).json({ error: 'You do not have access to the selected property.' });
      }
    }

    const status = derivePaymentStatus({ dueDate, paidDate });

    const payload = {
      tenant_id: nextTenantId,
      property_id: resolvedPropertyId,
      amount: nextAmount,
      due_date: dueDate,
      paid_date: paidDate,
      status,
      payment_date: paidDate ?? dueDate,
    };

    if (hasNote) {
      payload.note = typeof body.note === 'string' ? body.note.trim() || null : body.note ?? null;
    }

    const { data, error } = await updatePaymentWithFallback(paymentId, req.user.id, payload);
    if (error) {
      console.error(error);
      const statusCode = error?.code?.startsWith('22') || error?.code?.startsWith('23') ? 400 : 500;
      return res.status(statusCode).json({ error: 'Failed to update payment.', details: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    return res.json(normalizePaymentRecord(data));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unexpected server error while updating payment.' });
  }
});

module.exports = router;
