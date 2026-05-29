'use strict';

const express = require('express');
const { decryptRequest, encryptResponse } = require('../services/crypto');
const {
  listActiveServices,
  getService,
  nextOpenDays,
  availableSlots,
} = require('../services/slots');

const router = express.Router();

/**
 * Endpoint del Data Exchange del Flow.
 * Meta envía la petición cifrada y espera la respuesta cifrada en texto plano (base64).
 */
router.post('/flow', express.text({ type: '*/*' }), async (req, res) => {
  try {
    const body = JSON.parse(req.body);
    const { decryptedBody, aesKey, ivBuffer } = decryptRequest(body);

    // Petición de "salud" cuando publicas el Flow
    if (decryptedBody.action === 'ping') {
      return res
        .type('text/plain')
        .send(encryptResponse({ data: { status: 'active' } }, aesKey, ivBuffer));
    }

    const responseData = handleAction(decryptedBody);

    res
      .type('text/plain')
      .send(encryptResponse(responseData, aesKey, ivBuffer));
  } catch (err) {
    console.error('Error en /flow:', err.message);
    // 421 indica a Meta que descarte la clave AES y reintente
    res.status(421).send('Decryption failed');
  }
});

function handleAction(body) {
  const { action, screen, data = {} } = body;

  if (action === 'INIT') {
    return {
      screen: 'SERVICE',
      data: {
        services: listActiveServices().map((s) => ({
          id: String(s.id),
          title: `${s.name} · ${s.duration_min} min · ${s.price_eur} €`,
        })),
      },
    };
  }

  if (action !== 'data_exchange') {
    return { screen: 'SERVICE', data: {} };
  }

  if (screen === 'SERVICE') {
    return {
      screen: 'DATE',
      data: {
        service_id: data.service_id,
        dates: nextOpenDays(7),
      },
    };
  }

  if (screen === 'DATE') {
    return {
      screen: 'SLOT',
      data: {
        service_id: data.service_id,
        date: data.date,
        slots: availableSlots(data.service_id, data.date),
      },
    };
  }

  if (screen === 'SLOT') {
    const svc = getService(data.service_id);
    const dates = nextOpenDays(14);
    const dateTitle = dates.find((d) => d.id === data.date)?.title || data.date;
    return {
      screen: 'SUMMARY',
      data: {
        service_id: data.service_id,
        service_title: svc ? svc.name : 'Servicio',
        date: data.date,
        date_title: dateTitle,
        slot: data.slot,
      },
    };
  }

  return { screen: 'SERVICE', data: {} };
}

module.exports = router;
