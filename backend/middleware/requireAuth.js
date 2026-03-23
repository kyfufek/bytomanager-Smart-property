const { supabase } = require('../config/supabaseClient');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    req.user = data.user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify user token.' });
  }
}

module.exports = { requireAuth };
