// Generates the PWA icons (static/icon-192.png, icon-512.png, favicon.png)
// without any image library: raw RGBA buffer -> minimal PNG encoder.
// Run once via: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.2;
  // Brush stroke: segment from bottom-left to top-right
  const ax = size * 0.24;
  const ay = size * 0.76;
  const bx = size * 0.76;
  const by = size * 0.24;
  const halfWidth = size * 0.13;
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Rounded-rect alpha mask
      const cx = Math.max(radius, Math.min(size - radius, x + 0.5));
      const cy = Math.max(radius, Math.min(size - radius, y + 0.5));
      const dCorner = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const alpha = Math.max(0, Math.min(1, radius - dCorner + 1));
      if (alpha <= 0) continue;

      // Background: deep slate
      let r = 15;
      let g = 23;
      let b = 42;

      // Distance to stroke segment
      let t = ((x + 0.5 - ax) * abx + (y + 0.5 - ay) * aby) / abLenSq;
      t = Math.max(0, Math.min(1, t));
      const dx = x + 0.5 - (ax + abx * t);
      const dy = y + 0.5 - (ay + aby * t);
      const dist = Math.hypot(dx, dy);
      if (dist < halfWidth) {
        // Gradient blue (#3b82f6) -> pink (#ec4899) along the stroke
        const edge = Math.max(0, Math.min(1, halfWidth - dist));
        const sr = lerp(0x3b, 0xec, t);
        const sg = lerp(0x82, 0x48, t);
        const sb = lerp(0xf6, 0x99, t);
        r = lerp(r, sr, edge);
        g = lerp(g, sg, edge);
        b = lerp(b, sb, edge);
      }

      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

for (const [size, name] of [
  [512, 'icon-512.png'],
  [192, 'icon-192.png'],
  [64, 'favicon.png']
]) {
  writeFileSync(join(outDir, name), encodePng(size, size, drawIcon(size)));
  console.log(`wrote static/${name}`);
}
