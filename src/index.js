'use strict';

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const { initSchema } = require('./db');
const webhookRouter = require('./routes/webhook');
const flowRouter = require('./routes/flow');
const reminders = require('./jobs/reminders');

initSchema();

const app = express();
// IMPORTANTE: el endpoint /flow recibe texto cifrado, no JSON.
// El router de Flow ya usa express.text(), no apliques JSON aquí globalmente.
app.use('/flow', flowRouter);
app.use(bodyParser.json({ limit: '1mb' }));
app.use('/', webhookRouter);

app.get('/healthz', (_req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BarberBot escuchando en :${PORT}`);
  reminders.start();
});
