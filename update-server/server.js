'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const PORT        = 3000;
const UPDATES_DIR = 'C:/CeateaPOS/updates';

const app = express();

// Serve all files under /updates from the updates folder
app.use('/updates', (req, res, next) => {
  const filePath = path.join(UPDATES_DIR, req.path);

  // Safety: block path traversal
  if (!filePath.startsWith(path.resolve(UPDATES_DIR))) {
    return res.status(403).send('Forbidden');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).send('Not found');
  }

  res.sendFile(filePath);
});

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ceatea update server running on port ${PORT}`);
  console.log(`Serving files from: ${UPDATES_DIR}`);
  console.log(`Updates endpoint:   http://localhost:${PORT}/updates`);
});
