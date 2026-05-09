'use strict';

const fs   = require('fs');
const path = require('path');

let _configPath = null;

function getConfigPath() {
  if (_configPath) return _configPath;
  const { app } = require('electron');
  _configPath = path.join(app.getPath('userData'), 'ceatea-config.json');
  return _configPath;
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const merged = { ...readConfig(), ...patch };
  fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

module.exports = { readConfig, writeConfig };
