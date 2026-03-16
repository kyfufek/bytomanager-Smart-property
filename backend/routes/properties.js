const express = require('express');

const router = express.Router();

router.get('/properties', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'Byt 3+1 Praha',
      rent: 24500,
      paymentStatus: 'uhrazeno',
    },
    {
      id: 2,
      name: 'Byt 2+kk Brno',
      rent: 18900,
      paymentStatus: 'po splatnosti',
    },
    {
      id: 3,
      name: 'Byt 1+1 Plzen',
      rent: 13200,
      paymentStatus: 'ceka na platbu',
    },
  ]);
});

module.exports = router;
