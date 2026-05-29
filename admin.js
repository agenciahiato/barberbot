'use strict';

/**
 * Endpoints administrativos protegidos por el WEBHOOK_VERIFY_TOKEN.
 * Se usan una sola vez para tareas de configuración (registrar la clave pública del Flow).
 */

const express = require('express');
const axios = require('axios');

const router = express.Router();

function authorized(req) {
  return req.query.secret === process.env.WEBHOOK_VERIFY_TOKEN;
}

/**
 * Sube la clave pública del Flow a Meta.
 * Uso: GET /admin/register-key?secret=WEBHOOK_VERIFY_TOKEN
 */
router.get('/admin/register-key', async (req, res) => {
  if (!authorized(req)) return res.status(403).send('Forbidden');

  try {
    const publicKey = (process.env.FLOW_PUBLIC_KEY || '').replace(/\\n/g, '\n');
    if (!publicKey) {
      return res.status(400).send('Falta FLOW_PUBLIC_KEY en las variables de entorno.');
    }

    const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/whatsapp_business_encryption`;
    const params = new URLSearchParams();
    params.append('business_public_key', publicKey);

    const { data } = await axios.post(url, params, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    res.json({ ok: true, meta_response: data });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.response?.data || err.message,
    });
  }
});

/**
 * Devuelve el estado actual de la clave pública registrada en Meta.
 * Uso: GET /admin/key-status?secret=WEBHOOK_VERIFY_TOKEN
 */
router.get('/admin/key-status', async (req, res) => {
  if (!authorized(req)) return res.status(403).send('Forbidden');

  try {
    const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/whatsapp_business_encryption`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    });
    res.json({ ok: true, meta_response: data });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.response?.data || err.message,
    });
  }
});

module.exports = router;
