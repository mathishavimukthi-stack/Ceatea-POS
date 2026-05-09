# Ceatea POS

Desktop point-of-sale application built with Electron + SQLite.

---

## Auto-Update System

Updates are served from a server PC on the local network.
Shop PCs check for updates on launch and every 4 hours automatically.

### First-Time Setup

#### 1. On the server PC

Install Node.js, then install the update server:

```
cd update-server
npm install
```

Create the updates folder:

```
mkdir C:\CeateaPOS\updates
```

Start the server (runs on port 3000):

```
npm start
```

To run it automatically on Windows startup, install it as a service using
[NSSM](https://nssm.cc/) or add a shortcut to the Startup folder.

#### 2. Set the server IP

Find the server PC's local IP address (`ipconfig` in CMD, look for IPv4).

Edit this value in **two places** — replace `SERVER_IP` with the actual IP
(e.g. `192.168.1.50`):

- `main.js` line 6 — `UPDATE_SERVER_URL`
- `package.json` → `build.publish.url`

---

### Releasing an Update

1. Bump the version in `package.json` (`"version": "1.0.1"`)

2. Build with publish metadata:

   ```
   npx electron-builder build --win --publish always
   ```

   This produces:
   - `dist/Ceatea POS Setup 1.0.1.exe`
   - `dist/latest.yml`

3. Copy **all files** from `dist/` to `C:\CeateaPOS\updates\` on the server PC.

4. Shop PCs detect the update within 4 hours, or immediately on next launch.
   Staff see a dialog: **"Restart Now"** or **"Later"**.
   - **Restart Now** → downloads and installs immediately, app relaunches.
   - **Later** → an amber "↑ Update ready" badge appears in the top bar.
     Clicking it triggers download and install.

---

## Development

```
npm start          # run in dev mode (DevTools open automatically)
npm run dist       # build Windows installer without publish metadata
```

Database is stored in `%APPDATA%\Ceatea POS\ceatea.db` on each PC.
