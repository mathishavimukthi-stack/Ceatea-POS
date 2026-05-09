'use strict';

const { ipcMain }                    = require('electron');
const { getSupabase, resetSupabase } = require('./supabase-client');
const { readConfig, writeConfig }    = require('./config');

const ALLOWED = new Set(['products','transactions','customers','credit_accounts','quotations','invoices']);

let _mainWindow      = null;
let _realtimeChannel = null;

function registerIpcHandlers(mainWindow) {
  _mainWindow = mainWindow;

  // ── GENERIC INSERT / UPDATE / DELETE ─────────────────────────────────────
  ipcMain.handle('db:op', async (_e, table, method, data, matchField, matchVal) => {
    if (!ALLOWED.has(table)) throw new Error(`Table "${table}" not allowed`);
    const sb = getSupabase();

    if (method === 'insert') {
      const { data: row, error } = await sb.from(table).insert(data).select().single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }

    if (method === 'update') {
      const { error } = await sb.from(table).update(data).eq(matchField, matchVal);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (method === 'delete') {
      const { error } = await sb.from(table).delete().eq(matchField, matchVal);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    throw new Error(`Unknown method: ${method}`);
  });

  // ── INIT DATA ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:initData', async () => {
    let sb;
    try { sb = getSupabase(); } catch {
      return { products: [], transactions: [], customers: [], creditAccounts: [], quotations: [], invoices: [], writeOffs: [], notConfigured: true };
    }

    const [
      { data: pRaw  }, { data: txRaw }, { data: cuRaw },
      { data: crRaw }, { data: quRaw }, { data: inRaw }, { data: woRaw },
    ] = await Promise.all([
      sb.from('products').select('*').order('id'),
      sb.from('transactions').select('*').order('created_at', { ascending: false }),
      sb.from('customers').select('*').order('id'),
      sb.from('credit_accounts').select('*').order('id'),
      sb.from('quotations').select('*').order('created_at', { ascending: false }),
      sb.from('invoices').select('*').order('created_at', { ascending: false }),
      sb.from('write_offs').select('*').order('created_at', { ascending: false }),
    ]);

    const arr = v => Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : []);

    return {
      products: (pRaw || []).map(r => ({
        id: r.id, name: r.name, name_si: r.name_si || '', cat: r.cat,
        price: r.price, stock: r.stock, low: r.low, age: !!r.age,
        barcode: r.barcode || '', unit: r.unit || 'count', is_favourite: !!r.is_favourite,
      })),
      transactions: (txRaw || []).map(r => ({
        id: r.id, ref: r.ref, type: r.type, method: r.method,
        total: r.total, items: arr(r.items), time: r.created_at,
      })),
      customers: (cuRaw || []).map(r => ({
        id: r.id, name: r.name, email: r.email || '', phone: r.phone || '',
        creditBalance: r.credit_balance || 0, joined: r.created_at,
      })),
      creditAccounts: (crRaw || []).map(r => ({
        id: r.id, name: r.name, limit: r.credit_limit,
        balance: r.balance, history: arr(r.history),
      })),
      quotations: (quRaw || []).map(r => ({
        id: r.id, customer: r.customer, items: arr(r.items),
        total: r.total, status: r.status, date: r.created_at,
      })),
      invoices: (inRaw || []).map(r => ({
        id: r.id, customer: r.customer, items: arr(r.items),
        total: r.total, status: r.status, date: r.created_at, due: r.due_date || null,
      })),
      writeOffs: (woRaw || []).map(r => ({
        id: r.id, product: r.product_name, em: r.em || '📦',
        qty: r.qty, reason: r.reason, detail: r.detail || '', time: r.created_at,
      })),
    };
  });

  // ── WRITE-OFFS ────────────────────────────────────────────────────────────
  ipcMain.handle('db:insertWriteOff', async (_e, data) => {
    const sb = getSupabase();
    const { data: row, error } = await sb.from('write_offs').insert({
      product_id:   data.product_id   || null,
      product_name: data.product_name || '',
      em:           data.em           || '📦',
      qty:          data.qty,
      reason:       data.reason,
      detail:       data.detail       || '',
    }).select().single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:getSetting', async (_e, key) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? data.value : null;
    } catch { return null; }
  });

  ipcMain.handle('db:setSetting', async (_e, key, value) => {
    const sb = getSupabase();
    const { error } = await sb.from('settings').upsert({ key, value });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

  // ── SESSION (stored locally — per machine) ────────────────────────────────
  ipcMain.handle('db:getSession', () => readConfig().session || null);

  ipcMain.handle('db:setSession', (_e, data) => {
    writeConfig({ session: data });
    return { ok: true };
  });

  ipcMain.handle('db:clearSession', () => {
    writeConfig({ session: null });
    return { ok: true };
  });

  // ── SUPABASE CONFIG ───────────────────────────────────────────────────────
  ipcMain.handle('config:get', () => {
    const cfg = readConfig();
    return { supabaseUrl: cfg.supabaseUrl || '', supabaseKey: cfg.supabaseKey || '' };
  });

  ipcMain.handle('config:set', async (_e, cfg) => {
    writeConfig({ supabaseUrl: cfg.supabaseUrl, supabaseKey: cfg.supabaseKey });
    resetSupabase();
    setupRealtime();
    return { ok: true };
  });

  // ── REALTIME ──────────────────────────────────────────────────────────────
  setupRealtime();
}

function setupRealtime() {
  try {
    const sb = getSupabase();

    if (_realtimeChannel) {
      sb.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }

    _realtimeChannel = sb.channel('ceatea-pos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        _mainWindow?.webContents.send('realtime:change', { table: 'products', payload });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => {
        _mainWindow?.webContents.send('realtime:change', { table: 'transactions', payload });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, payload => {
        _mainWindow?.webContents.send('realtime:change', { table: 'customers', payload });
      })
      .subscribe(status => {
        _mainWindow?.webContents.send('realtime:status', status === 'SUBSCRIBED');
      });
  } catch {
    _mainWindow?.webContents.send('realtime:status', false);
  }
}

module.exports = { registerIpcHandlers };
