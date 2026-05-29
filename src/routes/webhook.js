'use strict';

const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { sendText, sendBookingFlow } = require('../services/whatsapp');
const { confirmBooking, cancelNext } = require('../services/booking');

const router = express.Router();

// ---------- Verificación del webhook (GET) ----------
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------- Recepción de mensajes (POST) ----------
router.post('/webhook', async (req, res) => {
  // Meta exige responder 200 lo antes posible. Procesamos en async.
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return;

    const from = message.from; // número del cliente
    const contactName = change?.contacts?.[0]?.profile?.name || null;

    // Upsert del cliente
    db.prepare(
      `INSERT INTO clients (wa_id, name) VALUES (?, ?)
       ON CONFLICT(wa_id) DO UPDATE SET name = COALESCE(excluded.name, clients.name)`
    ).run(from, contactName);

    if (message.type === 'text') {
      const body = (message.text?.body || '').toLowerCase().trim();
      if (/(cancel|anul)/i.test(body)) {
        const ok = await cancelNext(from);
        await sendText(
          from,
          ok
            ? 'Hecho. Tu próxima cita ha sido cancelada. Escribe "reservar" para pedir otra.'
            : 'No tienes ninguna cita pendiente. Escribe "reservar" para pedir una nueva.'
        );
        return;
      }
      if (/(reserv|cita|hora|cortar|barba|book)/i.test(body)) {
        const token = crypto.randomBytes(16).toString('hex');
        await sendBookingFlow(from, token);
      } else {
        await sendText(
          from,
          `¡Hola${contactName ? ' ' + contactName.split(' ')[0] : ''}! 👋 Para pedir cita escribe "reservar" y te abriré el formulario.`
        );
      }
      return;
    }

    // Respuesta de un Flow ya completado (cuando el Flow termina en "complete")
    if (
      message.type === 'interactive' &&
      message.interactive?.type === 'nfm_reply'
    ) {
      const raw = message.interactive.nfm_reply.response_json;
      const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      await confirmBooking(from, payload);
    }
  } catch (err) {
    console.error('Error procesando webhook:', err.response?.data || err.message);
  }
});

module.exports = router;
