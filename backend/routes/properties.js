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

async function insertPropertyWithFallback(basePayload) {
  const payload = { ...basePayload };
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;
    const result = await supabase.from('properties').insert(payload).select('*').single();
    if (!result.error) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || typeof payload[missingColumn] === 'undefined') {
      return result;
    }

    console.error(`[properties] Missing "${missingColumn}" column in Supabase table. Retrying insert without it.`, result.error);
    delete payload[missingColumn];
  }

  return { data: null, error: { message: 'Insert retry limit exceeded due schema mismatch.' } };
}

async function updatePropertyWithFallback(propertyId, ownerId, basePayload) {
  const payload = { ...basePayload };
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;
    const result = await supabase
      .from('properties')
      .update(payload)
      .eq('id', propertyId)
      .eq('owner_id', ownerId)
      .select();

    if (!result.error) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || typeof payload[missingColumn] === 'undefined') {
      return result;
    }

    console.error(`[properties] Missing "${missingColumn}" column in Supabase table. Retrying update without it.`, result.error);
    delete payload[missingColumn];
  }

  return { data: null, error: { message: 'Update retry limit exceeded due schema mismatch.' } };
}

router.get('/properties', async (req, res) => {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('owner_id', req.user.id);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch properties.', details: error.message });
  }

  const normalized = (data || []).map((row) => ({
    ...row,
    // Frontend expects this key.
    rent: Number(row.rent ?? 0),
    paymentStatus: row.paymentStatus ?? row.payment_status ?? 'ceka na platbu',
  }));

  return res.json(normalized);
});

router.post('/properties', async (req, res) => {
  const { name, address, city, postal_code, units_count, rent, notes } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }

  const payload = {
    name,
    address: address ?? null,
    city: city ?? null,
    postal_code: postal_code ?? null,
    units_count: Number.isFinite(Number(units_count)) && Number(units_count) > 0 ? Number(units_count) : 1,
    rent: Number.isFinite(Number(rent)) && Number(rent) >= 0 ? Number(rent) : 0,
    notes: notes ?? null,
    owner_id: req.user.id,
  };

  const { data, error } = await insertPropertyWithFallback(payload);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create property.', details: error.message });
  }

  return res.status(201).json({
    ...data,
    rent: Number(data?.rent ?? 0),
    paymentStatus: data?.paymentStatus ?? data?.payment_status ?? 'ceka na platbu',
  });
});

async function updatePropertyHandler(req, res) {
  try {
    const propertyId = req.params.id;
    if (!propertyId) {
      return res.status(400).json({ error: 'Missing property id.' });
    }

    const incoming = { ...(req.body || {}) };
    delete incoming.id;

    const { name, address, city, postal_code, units_count, rent, notes, payment_status } = incoming;

    const payload = {};
    if (typeof name !== 'undefined') payload.name = name;
    if (typeof address !== 'undefined') payload.address = address ?? null;
    if (typeof city !== 'undefined') payload.city = city ?? null;
    if (typeof postal_code !== 'undefined') payload.postal_code = postal_code ?? null;
    if (typeof units_count !== 'undefined') {
      payload.units_count = Number.isFinite(Number(units_count)) && Number(units_count) > 0 ? Number(units_count) : 1;
    }
    if (typeof rent !== 'undefined') {
      payload.rent = Number.isFinite(Number(rent)) && Number(rent) >= 0 ? Number(rent) : 0;
    }
    if (typeof notes !== 'undefined') payload.notes = notes ?? null;
    if (typeof payment_status !== 'undefined') payload.payment_status = payment_status;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update.' });
    }

    const { data, error } = await updatePropertyWithFallback(propertyId, req.user.id, payload);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to update property.', details: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const updated = data[0];

    return res.json({
      ...updated,
      rent: Number(updated?.rent ?? 0),
      paymentStatus: updated?.paymentStatus ?? updated?.payment_status ?? 'ceka na platbu',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update property.' });
  }
}

router.put('/properties/:id', updatePropertyHandler);
router.patch('/properties/:id', updatePropertyHandler);

router.delete('/properties/:id', async (req, res) => {
  const propertyId = req.params.id;
  if (!propertyId) {
    return res.status(400).json({ error: 'Missing property id.' });
  }

  const { data: existing, error: selectError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('owner_id', req.user.id)
    .maybeSingle();

  if (selectError) {
    return res.status(500).json({ error: 'Failed to validate property ownership.' });
  }

  if (!existing) {
    return res.status(404).json({ error: 'Property not found.' });
  }

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', propertyId)
    .eq('owner_id', req.user.id);

  if (error) {
    return res.status(500).json({ error: 'Failed to delete property.' });
  }

  return res.status(204).send();
});

module.exports = router;
