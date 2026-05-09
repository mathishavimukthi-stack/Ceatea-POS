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

  seedIfEmpty();
}

function seedIfEmpty() {
  const count = _db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return;

  const insProduct = _db.prepare(`
    INSERT INTO products (name,em,cat,price,stock,low,age) VALUES (?,?,?,?,?,?,?)
  `);
  const seedProducts = _db.transaction(() => {
    [
      ['Bananas',           '🍌','Fruit & Veg',0.79, 48,10,0],
      ['Apples 6pk',        '🍎','Fruit & Veg',1.49, 32,10,0],
      ['Potatoes 1.5kg',    '🥔','Fruit & Veg',1.10, 20, 8,0],
      ['Carrots 500g',      '🥕','Fruit & Veg',0.65, 15, 8,0],
      ['Broccoli',          '🥦','Fruit & Veg',0.79,  3, 5,0],
      ['Cherry Tomatoes',   '🍅','Fruit & Veg',1.35,  0, 5,0],
      ['Avocado',           '🥑','Fruit & Veg',0.90, 12, 5,0],
      ['Baby Spinach 200g', '🥬','Fruit & Veg',1.20,  8, 5,0],
      ['Milk 2L',           '🥛','Dairy',       1.55, 30,10,0],
      ['Cheddar 400g',      '🧀','Dairy',       3.20,  4, 5,0],
      ['Butter 250g',       '🧈','Dairy',       1.85, 18, 5,0],
      ['Greek Yoghurt',     '🍦','Dairy',       2.40, 12, 5,0],
      ['Free Range Eggs 6', '🥚','Dairy',       2.10, 22, 8,0],
      ['Oat Milk 1L',       '🥛','Dairy',       1.75,  2, 5,0],
      ['White Bread 800g',  '🍞','Bakery',      1.10, 14, 5,0],
      ['Sourdough Loaf',    '🥖','Bakery',      2.50,  6, 3,0],
      ['Croissants 4pk',    '🥐','Bakery',      2.20,  9, 3,0],
      ['Bagels 4pk',        '🥯','Bakery',      1.80, 11, 3,0],
      ['Chicken 500g',      '🍗','Meat',        4.50, 16, 5,0],
      ['Minced Beef 500g',  '🥩','Meat',        4.20,  8, 5,0],
      ['Smoked Salmon',     '🐟','Meat',        3.80,  4, 3,0],
      ['Back Bacon 300g',   '🥓','Meat',        3.40, 12, 5,0],
      ['Orange Juice 1L',   '🍊','Drinks',      1.65, 24, 8,0],
      ['Sparkling Water',   '💧','Drinks',      0.75, 40,10,0],
      ['Coca-Cola 6pk',     '🥤','Drinks',      5.50, 18, 5,0],
      ['Lager 4pk',         '🍺','Drinks',      4.80, 10, 5,1],
      ['Red Wine 75cl',     '🍷','Drinks',      7.50,  7, 3,1],
      ['Crisps',            '🍟','Snacks',      0.85, 50,15,0],
      ['Chocolate Bar',     '🍫','Snacks',      1.10, 35,10,0],
      ['Mixed Nuts 200g',   '🥜','Snacks',      3.20,  3, 5,0],
      ['Digestives 400g',   '🍪','Snacks',      1.45, 22, 8,0],
      ['Tobacco Pouch 30g', '🚬','Snacks',     12.50,  5, 3,1],
    ].forEach(r => insProduct.run(...r));
  });
  seedProducts();

  const insCust = _db.prepare(`
    INSERT INTO customers (name,email,phone,credit_balance) VALUES (?,?,?,?)
  `);
  const insCredit = _db.prepare(`
    INSERT INTO credit_accounts (name,credit_limit,balance) VALUES (?,?,?)
  `);
  const seedPeople = _db.transaction(() => {
    insCust.run('Aisha Perera',   'aisha@example.com', '0771 234 567', 0);
    insCust.run('Rohan Silva',    'rohan@example.com', '0712 345 678', 50);
    insCust.run('Nimal Fernando', 'nimal@example.com', '0765 432 100', 0);
    insCredit.run('Aisha Perera',   200, 0);
    insCredit.run('Rohan Silva',    150, 50);
    insCredit.run('Nimal Fernando', 100, 0);
  });
  seedPeople();
}

module.exports = { getDb };
