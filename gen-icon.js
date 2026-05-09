'use strict';
// Zero-dependency icon generator — uses only Node built-ins (zlib, fs, path)
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const BG   = { r: 22,  g: 169, b: 126 }; // #16a97e — Ceatea teal
const FG   = { r: 255, g: 255, b: 255 }; // white letter

// ── PIXEL RENDERER ──────────────────────────────────────────────────────────
function renderPixels(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.365;
  const innerR = size * 0.225;
  // C gap: right side, ±52° from the horizontal
  const gapDeg = 52;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI; // –180…+180

      // Ring pixels that are NOT in the right-side gap → white C
      const inRing = dist >= innerR && dist <= outerR;
      const inGap  = angleDeg >= -gapDeg && angleDeg <= gapDeg;
      const col    = (inRing && !inGap) ? FG : BG;

      pixels[idx]   = col.r;
      pixels[idx+1] = col.g;
      pixels[idx+2] = col.b;
      pixels[idx+3] = 255;
    }
  }
  return pixels;
}

// ── PNG ENCODER ─────────────────────────────────────────────────────────────
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ _crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length);
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([lb, tb, data, cb]);
}

function encodePNG(pixels, size) {
  // Build raw scanlines: 1 filter byte (None=0) + RGBA per pixel
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4;
      const di = y * (1 + size * 4) + 1 + x * 4;
      raw[di]   = pixels[si];
      raw[di+1] = pixels[si+1];
      raw[di+2] = pixels[si+2];
      raw[di+3] = pixels[si+3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── ICO ENCODER (embeds PNG directly — Vista+ compatible) ───────────────────
function encodeICO(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry[0] = 0; entry[1] = 0; // 0 = 256px
  entry[2] = 0; entry[3] = 0; // no palette
  entry.writeUInt16LE(1,  4);                  // planes
  entry.writeUInt16LE(32, 6);                  // bit depth
  entry.writeUInt32LE(pngBuf.length, 8);       // PNG data size
  entry.writeUInt32LE(6 + 16, 12);             // data offset

  return Buffer.concat([header, entry, pngBuf]);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

console.log('Rendering 512×512…');
const png512 = encodePNG(renderPixels(512), 512);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png512);
console.log('  ✓ assets/icon.png');

console.log('Rendering 256×256 for ICO…');
const png256 = encodePNG(renderPixels(256), 256);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), encodeICO(png256));
console.log('  ✓ assets/icon.ico');

console.log('Done.');
