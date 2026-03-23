const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function ensureProfileRow(userId, fallbackFullName) {
  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('id', userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message || 'Failed to fetch profile.');
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      full_name: normalizeText(fallbackFullName),
      phone: null,
    })
    .select('id, full_name, phone')
    .single();

  if (insertError) {
    throw new Error(insertError.message || 'Failed to create profile.');
  }

  return created;
}

router.get('/profile', async (req, res) => {
  try {
    const profile = await ensureProfileRow(req.user.id, req.user.user_metadata?.full_name);

    return res.json({
      id: req.user.id,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: req.user.email ?? null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch profile.', details: error.message });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const fullName = normalizeText(req.body?.full_name);
    const phone = normalizeText(req.body?.phone);

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: req.user.id,
          full_name: fullName,
          phone,
        },
        { onConflict: 'id' },
      )
      .select('id, full_name, phone')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile.', details: error.message });
    }

    return res.json({
      id: req.user.id,
      full_name: data?.full_name ?? null,
      phone: data?.phone ?? null,
      email: req.user.email ?? null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update profile.', details: error.message });
  }
});

module.exports = router;
