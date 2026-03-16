const express = require('express');

const router = express.Router();

router.post('/chat', (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Parametr "message" je povinny a musi byt nepradny retezec.',
    });
  }

  return res.json({
    response: `Toto je AI odpoved simulujici RAG system pro dotaz: ${message}`,
  });
});

module.exports = router;
