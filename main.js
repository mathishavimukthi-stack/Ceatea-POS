'use strict';

const path = require('path');

// ── UPDATE SERVER URL ─────────────────────────────────────────────────────────
// Change this IP to match the server PC on your local network.
const UPDATE_SERVER_URL = 'http://SERVER_IP:3000/updates';

setImmediate(() => {
  const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
  const { autoUpdater } = require('electron-updater');
  const { registerIpcHandlers } = require('./ipc-handlers');

  let mainWindow;

  // ── AUTO-UPDATER SETUP ─────────────────────────────────────────────────────
  autoUpdater.autoDownload   = false; // we prompt before downloading
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_SERVER_URL,
  });

  autoUpdater.on('update-available', () => {
    if (!mainWindow) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version of Ceatea POS is available.',
      detail: 'Restart now to install the update, or continue and install later.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (choice === 0) {
      // Download immediately — installer runs on quit
      autoUpdater.downloadUpdate();
    } else {
      // Tell the renderer to show the update badge in the nav bar
      mainWindow.webContents.send('update:badge-show');
    }
  });

  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', (err) => {
    // Silently log — don't interrupt staff with network errors
    console.error('[updater]', err.message);
  });

  // Renderer asks to download (badge clicked)
  ipcMain.on('update:download-now', () => {
    autoUpdater.downloadUpdate();
  });

  function checkForUpdates() {
    if (!app.isPackaged) return; // skip in dev
    autoUpdater.checkForUpdates().catch(() => {});
  }

  // ── WINDOW ─────────────────────────────────────────────────────────────────
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 860,
      minWidth: 1100,
      minHeight: 700,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        devTools: !app.isPackaged,
      },
      show: false,
      backgroundColor: '#f2f2ef',
    });

    Menu.setApplicationMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' });

      // Check on launch (5 s delay so the UI settles first)
      setTimeout(checkForUpdates, 5000);

      // Then every 4 hours
      setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
    });

    mainWindow.on('closed', () => { mainWindow = null; });
  }

  // ── APP LIFECYCLE ──────────────────────────────────────────────────────────
  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
});
