const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const propertiesRoutes = require('./routes/properties');
const tenantsRoutes = require('./routes/tenants');
const paymentsRouter = require('./routes/payments');
const profileRoutes = require('./routes/profile');
const contactRoutes = require('./routes/contact');
const aiChatRoutes = require('./routes/aiChat');
const advancedBillingRoutes = require('./routes/advancedBilling');
const utilitySettlementsRoutes = require('./routes/utilitySettlements');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', contactRoutes);
app.use('/api', propertiesRoutes);
app.use('/api', tenantsRoutes);
app.use('/api', profileRoutes);
app.use('/api/payments', paymentsRouter);
app.use('/api', aiChatRoutes);
app.use('/api', advancedBillingRoutes);
app.use('/api', utilitySettlementsRoutes);

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
