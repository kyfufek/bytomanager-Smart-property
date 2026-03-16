const express = require('express');

const router = express.Router();

router.get('/tenants', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'Jan Novak',
      apartment: 'Byt 3+1 Praha',
      deposit: 50000,
      currentDebt: 0,
    },
    {
      id: 2,
      name: 'Petra Svobodova',
      apartment: 'Byt 2+kk Brno',
      deposit: 38000,
      currentDebt: 6200,
    },
    {
      id: 3,
      name: 'Martin Dvorak',
      apartment: 'Byt 1+1 Plzen',
      deposit: 26000,
      currentDebt: 1500,
    },
  ]);
});

module.exports = router;
