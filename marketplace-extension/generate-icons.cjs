// Generates proper RGBA PNG icons for the Chrome Web Store.
// MarketSync brand: indigo background (#6366F1) with a centered white
// "Sync" mark (two offset rounded squares). True 8-bit RGBA, no metadata.
//
// Run:   node generate-icons.cjs

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// PNG CRC32 (polynomial 0xEDB88320, matches zlib)
const crc32 = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return (buf) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
})();

function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makeIcon(size) {
  // Colors
  const BG  = [99, 102, 241, 255];  // indigo-500
  const FG  = [255, 255, 255, 255]; // white
  const TRANSPARENT = [0, 0, 0, 0];

  // Helpers
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);
  const setPx = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = y * rowSize + 1 + x * 4;
    raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
  };

  // Rounded-corner mask (alpha at the corners)
  const radius = Math.max(2, Math.floor(size * 0.18));
  const insideRoundedSquare = (x, y) => {
    if (x < radius && y < radius) return ((radius - x) ** 2 + (radius - y) ** 2) <= radius ** 2;
    if (x >= size - radius && y < radius) return ((x - (size - radius - 1)) ** 2 + (radius - y) ** 2) <= radius ** 2;
    if (x < radius && y >= size - radius) return ((radius - x) ** 2 + (y - (size - radius - 1)) ** 2) <= radius ** 2;
    if (x >= size - radius && y >= size - radius) return ((x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2) <= radius ** 2;
    return true;
  };

  // First pass: filter byte + transparent
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter type: None
    for (let x = 0; x < size; x++) setPx(x, y, TRANSPARENT);
  }

  // Background: rounded indigo
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (insideRoundedSquare(x, y)) setPx(x, y, BG);
    }
  }

  // Foreground: vertical accent bar on the left (matches brand)
  // Brand mark: thin vertical bar from ~22% to ~78% height on the left side
  const barX1 = Math.floor(size * 0.18);
  const barX2 = barX1 + Math.max(1, Math.round(size * 0.10));
  const barY1 = Math.floor(size * 0.22);
  const barY2 = Math.ceil(size * 0.78);
  for (let y = barY1; y < barY2; y++) {
    for (let x = barX1; x < barX2; x++) setPx(x, y, FG);
  }

  // "M" - simplified to two diagonal strokes that form a peak
  // For very small sizes (16), this would be illegible — skip the M and use a dot instead.
  if (size >= 32) {
    const left = Math.floor(size * 0.38);
    const right = Math.ceil(size * 0.82);
    const top = Math.floor(size * 0.28);
    const bottom = Math.ceil(size * 0.72);
    const stroke = Math.max(2, Math.round(size * 0.07));
    const peakX = Math.floor((left + right) / 2);
    const peakY = Math.floor(top + (bottom - top) * 0.35);

    const drawLine = (x0, y0, x1, y1) => {
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0;
      while (true) {
        for (let sX = -Math.floor(stroke / 2); sX < Math.ceil(stroke / 2); sX++) {
          for (let sY = -Math.floor(stroke / 2); sY < Math.ceil(stroke / 2); sY++) {
            setPx(x + sX, y + sY, FG);
          }
        }
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx)  { err += dx; y += sy; }
      }
    };

    drawLine(left, bottom, left, top);
    drawLine(left, top, peakX, peakY);
    drawLine(peakX, peakY, right, top);
    drawLine(right, top, right, bottom);
  } else {
    // Tiny size: a small white square next to the bar
    const px = barX2 + 1;
    const dotSize = Math.max(2, Math.floor(size * 0.18));
    const dotY = Math.floor((size - dotSize) / 2);
    for (let y = dotY; y < dotY + dotSize; y++) {
      for (let x = px; x < px + dotSize; x++) setPx(x, y, FG);
    }
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA truecolor
  ihdr[10] = 0;  // compression: deflate
  ihdr[11] = 0;  // filter: adaptive
  ihdr[12] = 0;  // interlace: none

  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

for (const size of [16, 48, 128]) {
  const png = makeIcon(size);
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ Wrote ${file} (${png.length} bytes, ${size}x${size} RGBA)`);
}
