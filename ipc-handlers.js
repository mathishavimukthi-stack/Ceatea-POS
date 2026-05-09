'use strict';

const { ipcMain } = require('electron');
const { getDb }   = require('./db');

// Tables the renderer is allowed to touch
const ALLOWED = new Set(['products','transactions','customers','credit_accounts','quotations','invoices']);

// Serialize data for SQLite: stringify arrays/objects so they land as TEXT
function prep(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = (Array.isArray(v) || (v !== null && typeof v === 'object'))
      ? JSON.stringify(v)
      : v;
  }
  return out;
}

function registerIpcHandlers() {
  const db = getDb();

  // ── GENERIC INSERT / UPDATE / DELETE ─────────────────────────────────────
  ipcMain.handle('db:op', (_e, table, method, data, matchField, matchVal) => {
    if (!ALLOWED.has(table)) throw new Error(`Table "${table}" not allowed`);

    if (method === 'insert') {
      const d    = prep(data);
      const keys = Object.keys(d);
      const sql  = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
      const info = db.prepare(sql).run(...Object.values(d));
      return { id: info.lastInsertRowid };
    }

    if (method === 'update') {
      const d    = prep(data);
      const keys = Object.keys(d);
      const sql  = `UPDATE ${table} SET ${keys.map(k => `${k}=?`).join(',')} WHERE ${matchField}=?`;
      db.prepare(sql).run(...Object.values(d), matchVal);
      return { ok: true };
    }

    if (method === 'delete') {
      db.prepare(`DELETE FROM ${table} WHERE ${matchField}=?`).run(matchVal);
      return { ok: true };
    }

    throw new Error(`Unknown method: ${method}`);
  });

  // ── INIT DATA — load all tables at startup ────────────────────────────────
  ipcMain.handle('db:initData', () => {
    const parse = (str, fallback = []) => {
      try { return JSON.parse(str); } catch { return fallback; }
    };

    const products = db.prepare('SELECT * FROM products ORDER BY id').all().map(r => ({
      id:      r.id,
      name:    r.name,
      name_si: r.name_si || '',
      em:      r.em || '📦',
      cat:     r.cat,
      price:   r.price,
      stock:   r.stock,
      low:     r.low,
      age:     !!r.age,
      barcode: r.barcode || '',
      unit:    r.unit    || 'count',
    }));

    const transactions = db.prepare(
      'SELECT * FROM transactions ORDER BY created_at DESC'
    ).all().map(r => ({
      id:     r.id,
      ref:    r.ref,
      type:   r.type,
      method: r.method,
      total:  r.total,
      items:  parse(r.items),
      time:   r.created_at,
    }));

    const customers = db.prepare('SELECT * FROM customers ORDER BY id').all().map(r => ({
      id:            r.id,
      name:          r.name,
      email:         r.email  || '',
      phone:         r.phone  || '',
      creditBalance: r.credit_balance || 0,
      joined:        r.created_at,
    }));

    const creditAccounts = db.prepare('SELECT * FROM credit_accounts ORDER BY id').all().map(r => ({
      id:      r.id,
      name:    r.name,
      limit:   r.credit_limit,
      balance: r.balance,
      history: parse(r.history),
    }));

    const quotations = db.prepare(
      'SELECT * FROM quotations ORDER BY created_at DESC'
    ).all().map(r => ({
      id:       r.id,
      customer: r.customer,
      items:    parse(r.items),
      total:    r.total,
      status:   r.status,
      date:     r.created_at,
    }));

    const invoices = db.prepare(
      'SELECT * FROM invoices ORDER BY created_at DESC'
    ).all().map(r => ({
      id:       r.id,
      customer: r.customer,
      items:    parse(r.items),
      total:    r.total,
      status:   r.status,
      date:     r.created_at,
      due:      r.due_date || null,
    }));

    const writeOffs = db.prepare(
      'SELECT * FROM write_offs ORDER BY created_at DESC'
    ).all().map(r => ({
      id:      r.id,
      product: r.product_name,
      em:      r.em || '📦',
      qty:     r.qty,
      reason:  r.reason,
      detail:  r.detail || '',
      time:    r.created_at,
    }));

    return { products, transactions, customers, creditAccounts, quotations, invoices, writeOffs };
  });

  // ── WRITE-OFFS ────────────────────────────────────────────────────────────
  ipcMain.handle('db:insertWriteOff', (_e, data) => {
    const info = db.prepare(`
      INSERT INTO write_offs (product_id,product_name,em,qty,reason,detail)
      VALUES (?,?,?,?,?,?)
    `).run(
      data.product_id   || null,
      data.product_name || '',
      data.em           || '📦',
      data.qty,
      data.reason,
      data.detail       || ''
    );
    return { id: info.lastInsertRowid };
  });

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:getSetting', (_e, key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row ? row.value : null;
  });

  ipcMain.handle('db:setSetting', (_e, key, value) => {
    db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, value);
    return { ok: true };
  });

  // ── SESSION ───────────────────────────────────────────────────────────────
  ipcMain.handle('db:getSession', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key='__session'").get();
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
  });

  ipcMain.handle('db:setSession', (_e, data) => {
    db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('__session',?)").run(
      JSON.stringify(data)
    );
    return { ok: true };
  });

  ipcMain.handle('db:clearSession', () => {
    db.prepare("DELETE FROM settings WHERE key='__session'").run();
    return { ok: true };
  });
}

module.exports = { registerIpcHandlers };
