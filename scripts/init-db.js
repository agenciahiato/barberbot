'use strict';

require('dotenv').config();
const { db, initSchema } = require('../src/db');

initSchema();

const count = db.prepare('SELECT COUNT(*) AS c FROM services').get().c;
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO services (name, duration_min, price_eur) VALUES (?, ?, ?)'
  );
  const seed = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
  seed([
    ['Corte de pelo',          30, 15],
    ['Corte + barba',          45, 22],
    ['Arreglo de barba',       20, 10],
    ['Afeitado clásico',       30, 18],
    ['Corte niño (<12 años)',  30, 12],
  ]);
  console.log('Servicios de ejemplo insertados.');
}

console.log('Base de datos inicializada en', process.env.DATABASE_PATH || './data/barberbot.db');
