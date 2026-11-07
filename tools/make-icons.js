/* 纯 Node 内置模块生成 PWA PNG 图标（无第三方依赖）；运行: npm run icons */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

let TBL = null;
function crc32(buf) {
  if (!TBL) {
    TBL = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TBL[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const inRR = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const lerp = (a, b, t) => a + (b - a) * t;

/** draw(x,y,s,maskable) -> [r,g,b,a] */
function sample(x, y, s, maskable) {
  // maskable 图标内容缩入安全区（中心 80%）
  const k = maskable ? 0.80 : 1;
  const cx = s / 2;
  const X = cx + (x - cx) / k;
  const Y = cx + (y - cy_(s)) / k;
  const f = (v) => v * s;
  let r = 0, g = 0, b = 0, a = 0;

  // 背景
  const pad = maskable ? -s * 0.2 : f(0.02);
  if (inRR(X, Y, pad, pad, s - pad, s - pad, maskable ? 0 : f(0.225))) {
    const t = Math.min(1, Math.max(0, Y / s));
    r = lerp(78, 45, t); g = lerp(107, 70, t); b = lerp(240, 189, t); a = 255;
  } else if (!maskable) {
    return [0, 0, 0, 0];
  }

  // 纸页
  if (inRR(X, Y, f(0.245), f(0.17), f(0.755), f(0.83), f(0.055))) {
    r = 255; g = 255; b = 255; a = 255;
  } else return [r, g, b, a];

  // 文字行
  const lines = [[0.325, 0.60], [0.435, 0.66], [0.545, 0.52]];
  for (const [ly, lw] of lines) {
    if (inRR(X, Y, f(0.315), f(ly), f(0.315 + lw * 0.44), f(ly + 0.028), f(0.012))) {
      return [176, 192, 246, 255];
    }
  }
  // 底部短行
  if (inRR(X, Y, f(0.315), f(0.655), f(0.56), f(0.683), f(0.012))) return [176, 192, 246, 255];

  // 印章红方块
  if (inRR(X, Y, f(0.615), f(0.705), f(0.715), f(0.795), f(0.018))) return [180, 67, 58, 255];
  return [r, g, b, a];
}
function cy_(s) { return s / 2; }

function build(size, maskable) {
  const SS = 2;
  const w = size * SS, h = size * SS;
  const big = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = sample(x / SS, y / SS, size, maskable);
      const i = (y * w + x) * 4;
      big[i] = c[0]; big[i + 1] = c[1]; big[i + 2] = c[2]; big[i + 3] = c[3];
    }
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
        const i = ((y * SS + dy) * w + (x * SS + dx)) * 4;
        R += big[i]; G += big[i + 1]; B += big[i + 2]; A += big[i + 3];
      }
      const n = SS * SS, o = (y * size + x) * 4;
      out[o] = Math.round(R / n); out[o + 1] = Math.round(G / n);
      out[o + 2] = Math.round(B / n); out[o + 3] = Math.round(A / n);
    }
  }
  return png(size, out);
}

[[192, 'icon-192.png', false], [512, 'icon-512.png', false],
 [512, 'icon-maskable-512.png', true], [180, 'apple-touch-icon.png', false]]
  .forEach(([size, name, maskable]) => {
    fs.writeFileSync(path.join(OUT, name), build(size, maskable));
    console.log('生成', name);
  });
