'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // All-purpose insert / update / delete for the main data tables
  dbOp: (table, method, data, matchField, matchVal) =>
    ipcRenderer.invoke('db:op', table, method, data, matchField, matchVal),

  // Load all tables at startup — returns a single bundle
  initData: () => ipcRenderer.invoke('db:initData'),

  // Key-value settings (receipt config, etc.)
  getSetting: (key)        => ipcRenderer.invoke('db:getSetting', key),
  setSetting: (key, value) => ipcRenderer.invoke('db:setSetting', key, value),

  // Login session (stored locally on each PC)
  getSession:   ()     => ipcRenderer.invoke('db:getSession'),
  setSession:   (data) => ipcRenderer.invoke('db:setSession', data),
  clearSession: ()     => ipcRenderer.invoke('db:clearSession'),

  // Write-offs
  insertWriteOff: (data) => ipcRenderer.invoke('db:insertWriteOff', data),

  // Supabase config (URL + anon key, stored locally)
  configGet: ()    => ipcRenderer.invoke('config:get'),
  configSet: (cfg) => ipcRenderer.invoke('config:set', cfg),

  // Realtime events pushed from main process
  onRealtimeChange: (cb) => ipcRenderer.on('realtime:change', cb),
  onRealtimeStatus: (cb) => ipcRenderer.on('realtime:status', cb),

  // Auto-updater
  onUpdateBadge:  (cb) => ipcRenderer.on('update:badge-show', cb),
  downloadUpdate: ()   => ipcRenderer.send('update:download-now'),
});
