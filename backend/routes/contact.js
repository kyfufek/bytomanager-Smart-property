const express = require('express');

const router = express.Router();

function normalizeField(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/contact', async (req, res) => {
  const name = normalizeField(req.body?.name);
  const email = normalizeField(req.body?.email);
  const message = normalizeField(req.body?.message);
  const webhookUrl = normalizeField(process.env.N8N_CONTACT_WEBHOOK_URL);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email address is invalid.' });
  }

  if (name.length > 120 || email.length > 160 || message.length > 5000) {
    return res.status(400).json({ error: 'Contact form payload is too long.' });
  }

  if (!webhookUrl) {
    return res.status(502).json({ error: 'Contact webhook is unavailable.' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        message,
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Contact webhook is unavailable.' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: 'Contact webhook is unavailable.' });
  }
});

module.exports = router;
