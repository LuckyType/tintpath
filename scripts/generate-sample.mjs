// Generates static/sample.png — the built-in demo photo (dusk mountain lake).
// Pure Node, no image library: raw RGBA -> minimal PNG encoder.
// Run once via: node scripts/generate-sample.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'sample.png');

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
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const W = 800;
const H = 600;
const px = Buffer.alloc(W * H * 4);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

const HORIZON = 380;
const SUN = { x: 540, y: 300, r: 46 };

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // Dusk sky gradient: deep blue -> peach at the horizon
    let c = mix([52, 68, 140], [244, 176, 120], Math.min(1, y / HORIZON) ** 1.4);

    // Sun with soft halo
    const sunDist = Math.hypot(x - SUN.x, y - SUN.y);
    if (sunDist < SUN.r) c = [252, 224, 150];
    else if (sunDist < SUN.r * 2.4 && y < HORIZON) {
      c = mix(c, [250, 200, 130], (1 - (sunDist - SUN.r) / (SUN.r * 1.4)) * 0.5);
    }

    // Back ridge
    const ridge1 = 300 + 46 * Math.sin(x / 130 + 1.2) + 20 * Math.sin(x / 47);
    if (y > ridge1 && y <= HORIZON) c = [96, 82, 128];
    // Front ridge
    const ridge2 = 336 + 34 * Math.sin(x / 90 + 3.6) + 14 * Math.sin(x / 31 + 1);
    if (y > ridge2 && y <= HORIZON) c = [64, 56, 96];

    // Lake: mirrored dusk colors, darker, with a sun glitter column
    if (y > HORIZON) {
      const depth = (y - HORIZON) / (H - HORIZON);
      c = mix([236, 160, 110], [36, 48, 92], depth ** 0.8);
      const glitter = Math.abs(x - SUN.x) < 60 * (1 - depth * 0.55);
      if (glitter && Math.sin(y * 0.9) > -0.3) c = mix(c, [250, 214, 150], 0.55 - depth * 0.3);
    }

    const i = (y * W + x) * 4;
    px[i] = Math.round(c[0]);
    px[i + 1] = Math.round(c[1]);
    px[i + 2] = Math.round(c[2]);
    px[i + 3] = 255;
  }
}

// Pine tree silhouettes on the right bank
function pine(cx, baseY, height, halfWidth) {
  for (let dy = 0; dy < height; dy++) {
    const y = baseY - dy;
    if (y < 0 || y >= H) continue;
    const w = Math.max(1, halfWidth * (1 - dy / height) * (0.72 + 0.28 * Math.sin(dy * 1.4)));
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
      if (x < 0 || x >= W) continue;
      const i = (y * W + x) * 4;
      px[i] = 24;
      px[i + 1] = 34;
      px[i + 2] = 38;
    }
  }
  // Trunk
  for (let dy = 0; dy < 12; dy++) {
    const y = baseY + dy;
    if (y >= H) continue;
    for (let x = Math.round(cx - 2); x <= Math.round(cx + 2); x++) {
      const i = (y * W + x) * 4;
      px[i] = 20;
      px[i + 1] = 26;
      px[i + 2] = 30;
    }
  }
}
pine(700, 392, 130, 34);
pine(752, 400, 96, 26);
pine(660, 396, 78, 20);

writeFileSync(outPath, encodePng(W, H, px));
console.log('wrote static/sample.png');
