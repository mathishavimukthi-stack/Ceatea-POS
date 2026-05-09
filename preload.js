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

  // Login session
  getSession:   ()     => ipcRenderer.invoke('db:getSession'),
  setSession:   (data) => ipcRenderer.invoke('db:setSession', data),
  clearSession: ()     => ipcRenderer.invoke('db:clearSession'),

  // Write-offs (own table, special handler for history load)
  insertWriteOff: (data) => ipcRenderer.invoke('db:insertWriteOff', data),

  // Auto-updater
  onUpdateBadge:  (cb) => ipcRenderer.on('update:badge-show', cb),
  downloadUpdate: ()   => ipcRenderer.send('update:download-now'),
});
