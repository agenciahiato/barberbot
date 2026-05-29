'use strict';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
require('dayjs/locale/es');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');

const { db } = require('../db');
const { getService, shopCfg } = require('./slots');
const { sendText } = require('./whatsapp');

/**
 * Crea la cita tras un Flow completado.
 * payload viene del Flow:
 *   { service_id, service_title, date: 'YYYY-MM-DD', slot: 'HH:mm', name }
 */
async function confirmBooking(waId, payload) {
  const { service_id, date, slot, name } = payload;
  const svc = getService(service_id);
  if (!svc) {
    await sendText(waId, 'Lo siento, el servicio elegido ya no está disponible. Escribe "reservar" para intentarlo otra vez.');
    return;
  }

  const { tz } = shopCfg();
  const starts = dayjs.tz(`${date} ${slot}`, 'YYYY-MM-DD HH:mm', tz);
  const ends = starts.add(svc.duration_min, 'minute');

  // Actualizar nombre del cliente si lo dio
  if (name) {
    db.prepare('UPDATE clients SET name = ? WHERE wa_id = ?').run(name, waId);
  }
  const client = db.prepare('SELECT id FROM clients WHERE wa_id = ?').get(waId);

  // Comprobación final de doble reserva
  const overlap = db
    .prepare(
      `SELECT 1 FROM appointments
       WHERE status = 'confirmed'
         AND starts_at < ? AND ends_at > ?`
    )
    .get(ends.utc().toISOString(), starts.utc().toISOString());

  if (overlap) {
    await sendText(
      waId,
      `Lo siento, esa hora se acaba de ocupar. Escribe "reservar" para elegir otra disponible.`
    );
    return;
  }

  db.prepare(
    `INSERT INTO appointments (client_id, service_id, starts_at, ends_at)
     VALUES (?, ?, ?, ?)`
  ).run(client.id, svc.id, starts.utc().toISOString(), ends.utc().toISOString());

  const human = starts.tz(tz).format('dddd D [de] MMMM [a las] HH:mm');
  await sendText(
    waId,
    `✅ ¡Cita confirmada${name ? ', ' + name.split(' ')[0] : ''}!\n\n` +
      `💈 ${svc.name}\n📅 ${human}\n💶 ${svc.price_eur} €\n\n` +
      `Te recordaremos la cita el día anterior. Si necesitas cambiarla, escribe "cancelar".`
  );
}

/**
 * Cancelación simple por número: marca la próxima cita confirmada como cancelada.
 */
async function cancelNext(waId) {
  const client = db.prepare('SELECT id FROM clients WHERE wa_id = ?').get(waId);
  if (!client) return false;
  const appt = db
    .prepare(
      `SELECT * FROM appointments
       WHERE client_id = ? AND status = 'confirmed' AND starts_at > datetime('now')
       ORDER BY starts_at ASC LIMIT 1`
    )
    .get(client.id);
  if (!appt) return false;
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(appt.id);
  return true;
}

module.exports = { confirmBooking, cancelNext };
