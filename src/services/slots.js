'use strict';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
require('dayjs/locale/es');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.locale('es');

const { db } = require('../db');

function shopCfg() {
  return {
    tz: process.env.SHOP_TIMEZONE || 'Europe/Madrid',
    open: Number(process.env.SHOP_OPEN_HOUR || 10),
    close: Number(process.env.SHOP_CLOSE_HOUR || 20),
    slot: Number(process.env.SHOP_SLOT_MINUTES || 30),
    closedDays: (process.env.SHOP_CLOSED_DAYS || '0')
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => !Number.isNaN(n)),
  };
}

function getService(serviceId) {
  return db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(serviceId);
}

function listActiveServices() {
  return db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY id').all();
}

/**
 * Próximos N días abiertos (para el desplegable del Flow).
 */
function nextOpenDays(n = 7) {
  const { tz, closedDays } = shopCfg();
  const out = [];
  let cursor = dayjs().tz(tz).startOf('day');
  while (out.length < n) {
    if (!closedDays.includes(cursor.day())) {
      out.push({
        id: cursor.format('YYYY-MM-DD'),
        title: cursor.format('dddd D [de] MMMM').replace(/^./, (c) => c.toUpperCase()),
      });
    }
    cursor = cursor.add(1, 'day');
  }
  return out;
}

/**
 * Slots libres para un día y servicio dado.
 * Considera duración del servicio y citas ya confirmadas que se solapen.
 */
function availableSlots(serviceId, dateStr) {
  const svc = getService(serviceId);
  if (!svc) return [];

  const { tz, open, close, slot, closedDays } = shopCfg();
  const day = dayjs.tz(dateStr, tz);
  if (closedDays.includes(day.day())) return [];

  const now = dayjs().tz(tz);
  const dayStart = day.hour(open).minute(0).second(0);
  const dayEnd = day.hour(close).minute(0).second(0);

  // Citas confirmadas del día (en UTC ISO)
  const dayStartUtc = dayStart.utc().toISOString();
  const dayEndUtc = dayEnd.utc().toISOString();
  const taken = db
    .prepare(
      `SELECT starts_at, ends_at FROM appointments
       WHERE status = 'confirmed' AND starts_at < ? AND ends_at > ?`
    )
    .all(dayEndUtc, dayStartUtc);

  // Dos rangos solapan si s < t.end && e > t.start
  const overlaps = (s, e) =>
    taken.some((t) => s.isBefore(dayjs(t.ends_at)) && e.isAfter(dayjs(t.starts_at)));

  const slots = [];
  let cursor = dayStart;
  while (cursor.add(svc.duration_min, 'minute').isSameOrBefore(dayEnd)) {
    const end = cursor.add(svc.duration_min, 'minute');
    if (cursor.isAfter(now) && !overlaps(cursor, end)) {
      slots.push({ id: cursor.format('HH:mm'), title: cursor.format('HH:mm') });
    }
    cursor = cursor.add(slot, 'minute');
  }
  return slots;
}

module.exports = {
  listActiveServices,
  getService,
  nextOpenDays,
  availableSlots,
  shopCfg,
};
