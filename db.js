'use strict';

const Database = require('better-sqlite3');
const path     = require('path');

let _db   = null;
let _path = null;

function getDb() {
  if (_db) return _db;
  if (!_path) {
    // Lazy: only safe to call after app is ready
    const { app } = require('electron');
    _path = path.join(app.getPath('userData'), 'ceatea.db');
  }
  _db = new Database(_path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema();
  return _db;
}

function initSchema() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name    TEXT    NOT NULL,
      em      TEXT    NOT NULL DEFAULT '📦',
      cat     TEXT    NOT NULL,
      price   REAL    NOT NULL DEFAULT 0,
      stock   INTEGER NOT NULL DEFAULT 0,
      low     INTEGER NOT NULL DEFAULT 5,
      age     INTEGER NOT NULL DEFAULT 0,
      barcode TEXT    NOT NULL DEFAULT '',
      unit    TEXT    NOT NULL DEFAULT 'count',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      ref     TEXT    NOT NULL UNIQUE,
      type    TEXT    NOT NULL CHECK(type IN ('sale','refund')),
      method  TEXT    NOT NULL,
      total   REAL    NOT NULL,
      items   TEXT    NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL DEFAULT '',
      phone          TEXT NOT NULL DEFAULT '',
      credit_balance REAL NOT NULL DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_accounts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      credit_limit REAL NOT NULL DEFAULT 100,
      balance      REAL NOT NULL DEFAULT 0,
      history      TEXT NOT NULL DEFAULT '[]',
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id         TEXT PRIMARY KEY,
      customer   TEXT NOT NULL,
      items      TEXT NOT NULL DEFAULT '[]',
      total      REAL NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'Draft',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id         TEXT PRIMARY KEY,
      customer   TEXT NOT NULL,
      items      TEXT NOT NULL DEFAULT '[]',
      total      REAL NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'Pending',
      due_date   TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS write_offs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER,
      product_name TEXT NOT NULL,
      em           TEXT NOT NULL DEFAULT '📦',
      qty          INTEGER NOT NULL,
      reason       TEXT NOT NULL,
      detail       TEXT NOT NULL DEFAULT '',
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add name_si if the column doesn't exist yet
  try { _db.exec(`ALTER TABLE products ADD COLUMN name_si TEXT NOT NULL DEFAULT ''`); } catch {}
  // Migration: add is_favourite if the column doesn't exist yet
  try { _db.exec(`ALTER TABLE products ADD COLUMN is_favourite INTEGER NOT NULL DEFAULT 0`); } catch {}

}

module.exports = { getDb };
