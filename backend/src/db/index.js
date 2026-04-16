'use strict';

const fs   = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const log  = require('../utils/logger');
const { DB_PATH } = require('../config');

// Singleton promise — prevents double-initialisation under concurrent calls
let _dbPromise = null;

async function getDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = _init();
  return _dbPromise;
}

async function _init() {
  const SQL = await initSqlJs();

  const useFile = DB_PATH !== ':memory:';
  if (useFile) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  let fileBuffer = null;
  if (useFile && fs.existsSync(DB_PATH)) {
    fileBuffer = fs.readFileSync(DB_PATH);
  }

  const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
  _migrate(db);

  if (useFile) {
    // Async auto-save: write to a temp file then rename (atomic write, non-blocking)
    db._autoSave = () => {
      const data   = db.export();
      const tmp    = DB_PATH + '.tmp';
      fs.writeFile(tmp, Buffer.from(data), err => {
        if (err) { log.warn({ err: err.message }, 'DB auto-save write failed'); return; }
        fs.rename(tmp, DB_PATH, renameErr => {
          if (renameErr) log.warn({ err: renameErr.message }, 'DB auto-save rename failed');
        });
      });
    };
  }

  log.info({ dbPath: useFile ? DB_PATH : ':memory:' }, 'Database initialised');
  return db;
}

// Reset for testing (allows fresh DB per test suite)
function _resetForTesting() {
  _dbPromise = null;
}

function _migrate(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id          TEXT PRIMARY KEY,
      stall_id    TEXT NOT NULL,
      stall_name  TEXT NOT NULL,
      zone        TEXT NOT NULL,
      items       TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'confirmed',
      wait_time   INTEGER NOT NULL,
      ready_at    INTEGER NOT NULL,
      points      INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id          TEXT PRIMARY KEY,
      zone        TEXT NOT NULL,
      zone_name   TEXT NOT NULL,
      type        TEXT NOT NULL,
      message     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sim_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC)`);
}

// ─── Orders ───────────────────────────────────────────────────────────────────
async function insertOrder(order) {
  const db = await getDb();
  db.run(
    `INSERT INTO orders
       (id,stall_id,stall_name,zone,items,user_id,status,wait_time,ready_at,points,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      order.id, order.stallId, order.stallName, order.zone,
      JSON.stringify(order.items), order.userId, order.status,
      order.waitTime, order.readyAt, order.pointsEarned, order.timestamp,
    ]
  );
  if (db._autoSave) db._autoSave();
}

async function getRecentOrders(limit = 50) {
  const db  = await getDb();
  const res = db.exec(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`, [limit]);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj  = Object.fromEntries(columns.map((c, i) => [c, row[i]]));
    obj.items  = JSON.parse(obj.items);
    return obj;
  });
}

async function countOrders() {
  const db  = await getDb();
  const res = db.exec(`SELECT COUNT(*) as cnt FROM orders`);
  return res[0]?.values[0][0] ?? 0;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
async function insertAlert(alert) {
  const db = await getDb();
  db.run(
    `INSERT OR REPLACE INTO alerts (id,zone,zone_name,type,message,created_at)
     VALUES (?,?,?,?,?,?)`,
    [alert.id, alert.zone, alert.zoneName, alert.type, alert.message, alert.timestamp]
  );
  db.run(
    `DELETE FROM alerts
     WHERE id NOT IN (SELECT id FROM alerts ORDER BY created_at DESC LIMIT 100)`
  );
  if (db._autoSave) db._autoSave();
}

async function getRecentAlerts(limit = 20) {
  const db  = await getDb();
  const res = db.exec(`SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?`, [limit]);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

// ─── Sim state ────────────────────────────────────────────────────────────────
async function saveSimMode(mode) {
  const db = await getDb();
  db.run(`INSERT OR REPLACE INTO sim_state (key, value) VALUES ('mode', ?)`, [mode]);
  if (db._autoSave) db._autoSave();
}

async function loadSimMode() {
  const db  = await getDb();
  const res = db.exec(`SELECT value FROM sim_state WHERE key='mode'`);
  return res[0]?.values[0][0] ?? 'normal';
}

module.exports = {
  getDb,
  insertOrder, getRecentOrders, countOrders,
  insertAlert, getRecentAlerts,
  saveSimMode, loadSimMode,
  _resetForTesting,
};
