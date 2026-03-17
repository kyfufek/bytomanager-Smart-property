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
