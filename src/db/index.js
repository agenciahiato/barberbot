'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || './data/barberbot.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(sql);
}

module.exports = { db, initSchema };
