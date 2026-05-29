'use strict';

const axios = require('axios');

const GRAPH_URL = 'https://graph.facebook.com/v20.0';

function api() {
  return axios.create({
    baseURL: `${GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}`,
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

/** Envía un mensaje de texto plano. */
async function sendText(to, body) {
  return api().post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
}

/**
 * Envía un mensaje interactivo que abre un WhatsApp Flow.
 * El cliente toca el botón y se abre el formulario de reserva.
 */
async function sendBookingFlow(to, flowToken) {
  return api().post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: {
        type: 'text',
        text: `Reservar en ${process.env.SHOP_NAME || 'la barbería'}`,
      },
      body: {
        text: '¡Hola! Toca el botón para elegir servicio, día y hora. Tarda menos de 30 segundos.',
      },
      footer: { text: 'Reservas vía WhatsApp' },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: process.env.FLOW_ID,
          flow_cta: 'Reservar cita',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'SERVICE',
            data: {},
          },
        },
      },
    },
  });
}

module.exports = { sendText, sendBookingFlow };
