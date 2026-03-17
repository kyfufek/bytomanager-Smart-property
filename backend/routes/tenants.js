const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/tenants', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*, properties(name)')
    .eq('owner_id', req.user.id);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch tenants.' });
  }

  const normalized = (data || []).map((row) => ({
    ...row,
    // Frontend currently expects these keys.
    name: row.name ?? row.full_name,
    apartment: row.apartment ?? row.properties?.name ?? null,
    deposit: Number(row.deposit ?? 0),
    currentDebt: Number(row.currentDebt ?? row.current_debt ?? 0),
  }));

  return res.json(normalized);
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
    .select('*, properties(name)')
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to create tenant.' });
  }

  return res.status(201).json({
    ...data,
    name: data?.name ?? data?.full_name,
    apartment: data?.apartment ?? data?.properties?.name ?? null,
    deposit: Number(data?.deposit ?? 0),
    currentDebt: Number(data?.currentDebt ?? data?.current_debt ?? 0),
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
