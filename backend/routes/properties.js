const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/properties', async (req, res) => {
  const { data, error } = await supabase
    .from('properties')
    .select('id, owner_id, name, address, city, postal_code, units_count, rent, payment_status, notes, created_at, updated_at')
    .eq('owner_id', req.user.id);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch properties.' });
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

  const { data, error } = await supabase
    .from('properties')
    .insert(payload)
    .select('id, owner_id, name, address, city, postal_code, units_count, rent, payment_status, notes, created_at, updated_at')
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to create property.' });
  }

  return res.status(201).json({
    ...data,
    rent: Number(data?.rent ?? 0),
    paymentStatus: data?.paymentStatus ?? data?.payment_status ?? 'ceka na platbu',
  });
});

router.put('/properties/:id', async (req, res) => {
  const propertyId = req.params.id;
  if (!propertyId) {
    return res.status(400).json({ error: 'Missing property id.' });
  }

  const { name, address, city, postal_code, units_count, rent, notes, payment_status } = req.body || {};

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

  const { data, error } = await supabase
    .from('properties')
    .update(payload)
    .eq('id', propertyId)
    .eq('owner_id', req.user.id)
    .select('id, owner_id, name, address, city, postal_code, units_count, rent, payment_status, notes, created_at, updated_at');

  if (error) {
    return res.status(500).json({ error: 'Failed to update property.' });
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
});

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
