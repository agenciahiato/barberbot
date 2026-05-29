'use strict';

const cron = require('node-cron');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
require('dayjs/locale/es');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');

const { db } = require('../db');
const { sendText } = require('../services/whatsapp');

/**
 * Busca citas confirmadas dentro de las próximas 24-25h
 * sin recordatorio enviado y envía el aviso.
 */
async function sendDueReminders() {
  const now = dayjs().utc();
  const windowStart = now.add(23, 'hour').toISOString();
  const windowEnd = now.add(25, 'hour').toISOString();

  const rows = db
    .prepare(
      `SELECT a.id, a.starts_at, s.name AS service_name, c.wa_id, c.name AS client_name
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       JOIN clients  c ON c.id = a.client_id
       WHERE a.status = 'confirmed'
         AND a.reminder_sent = 0
         AND a.starts_at BETWEEN ? AND ?`
    )
    .all(windowStart, windowEnd);

  const tz = process.env.SHOP_TIMEZONE || 'Europe/Madrid';
  for (const r of rows) {
    try {
      const human = dayjs(r.starts_at).tz(tz).format('dddd D [de] MMMM [a las] HH:mm');
      const first = r.client_name ? ', ' + r.client_name.split(' ')[0] : '';
      await sendText(
        r.wa_id,
        `⏰ Recordatorio${first}: mañana tienes tu cita de ${r.service_name} ${human}. ¡Te esperamos!\n\nResponde "cancelar" si no puedes venir.`
      );
      db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(r.id);
    } catch (err) {
      console.error('Error enviando recordatorio a', r.wa_id, err.response?.data || err.message);
    }
  }

  if (rows.length) console.log(`Recordatorios enviados: ${rows.length}`);
}

function start() {
  // Cada hora en el minuto 5
  cron.schedule('5 * * * *', sendDueReminders);
  console.log('Cron de recordatorios activo (cada hora).');
}

module.exports = { start, sendDueReminders };
