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

function isMissingPhoneColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  const text = `${message} ${details} ${hint}`;

  if ((code === 'PGRST204' || code === '42703') && text.includes('phone')) {
    return true;
  }
  return text.includes('phone') && (
    text.includes('does not exist')
    || text.includes('could not find')
    || text.includes('schema cache')
    || text.includes('column')
  );
}

async function fetchProfileById(userId, includePhone) {
  const selectColumns = includePhone ? 'id, full_name, phone' : 'id, full_name';
  const { data, error } = await supabase
    .from('profiles')
    .select(selectColumns)
    .eq('id', userId)
    .maybeSingle();
  return { data, error };
}

async function ensureProfileRow(userId, fallbackFullName) {
  let phoneSupported = true;
  let { data: existing, error: selectError } = await fetchProfileById(userId, true);

  if (selectError && isMissingPhoneColumnError(selectError)) {
    phoneSupported = false;
    const fallback = await fetchProfileById(userId, false);
    existing = fallback.data;
    selectError = fallback.error;
  }
  if (selectError) throw new Error(selectError.message || 'Failed to fetch profile.');

  if (existing) {
    return {
      full_name: existing.full_name ?? null,
      phone: phoneSupported ? existing.phone ?? null : null,
      phone_supported: phoneSupported,
    };
  }

  const insertPayload = {
    id: userId,
    full_name: normalizeText(fallbackFullName),
    ...(phoneSupported ? { phone: null } : {}),
  };

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert(insertPayload)
    .select(phoneSupported ? 'id, full_name, phone' : 'id, full_name')
    .single();

  if (insertError && phoneSupported && isMissingPhoneColumnError(insertError)) {
    phoneSupported = false;
    const { data: createdWithoutPhone, error: retryError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: normalizeText(fallbackFullName),
      })
      .select('id, full_name')
      .single();

    if (retryError) {
      throw new Error(retryError.message || 'Failed to create profile.');
    }

    return {
      full_name: createdWithoutPhone?.full_name ?? null,
      phone: null,
      phone_supported: false,
    };
  }

  if (insertError) {
    throw new Error(insertError.message || 'Failed to create profile.');
  }

  return {
    full_name: created?.full_name ?? null,
    phone: phoneSupported ? created?.phone ?? null : null,
    phone_supported: phoneSupported,
  };
}

router.get('/profile', async (req, res) => {
  try {
    const profile = await ensureProfileRow(req.user.id, req.user.user_metadata?.full_name);

    return res.json({
      id: req.user.id,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      phone_supported: profile?.phone_supported ?? true,
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
    let phoneSupported = true;

    let { data, error } = await supabase
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

    if (error && isMissingPhoneColumnError(error)) {
      phoneSupported = false;
      const fallback = await supabase
        .from('profiles')
        .upsert(
          {
            id: req.user.id,
            full_name: fullName,
          },
          { onConflict: 'id' },
        )
        .select('id, full_name')
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile.', details: error.message });
    }

    return res.json({
      id: req.user.id,
      full_name: data?.full_name ?? null,
      phone: phoneSupported ? data?.phone ?? null : null,
      phone_supported: phoneSupported,
      email: req.user.email ?? null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update profile.', details: error.message });
  }
});

module.exports = router;
