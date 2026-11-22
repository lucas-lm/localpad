// Generates the PWA PNG icons with no external dependencies (zlib + a minimal PNG encoder).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x2f, 0x5d, 0x50];
const PAGE = [0xfb, 0xfa, 0xf7];
const LINE = [0x2f, 0x5d, 0x50];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Rounded rectangle in normalized coordinates (0..1).
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

function render(size, { maskable }) {
  const s = maskable ? 0.8 : 1; // keep the glyph inside the safe zone for maskable icons
  const o = (1 - s) / 2;
  const shapes = [
    { color: BG, test: (x, y) => (maskable ? true : inRoundRect(x, y, 0, 0, 1, 1, 0.22)) },
    { color: PAGE, test: (x, y) => inRoundRect(x, y, o + s * 0.26, o + s * 0.2, o + s * 0.74, o + s * 0.8, s * 0.05) },
    ...[0.36, 0.48, 0.6].map((ly, i) => ({
      color: LINE,
      test: (x, y) => inRoundRect(x, y, o + s * 0.34, o + s * ly, o + s * (i === 2 ? 0.55 : 0.66), o + s * (ly + 0.045), s * 0.02),
    })),
  ];
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          let col = null;
          for (const sh of shapes) if (sh.test(x, y)) col = sh.color;
          if (col) { acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255; }
        }
      const n = SS * SS;
      const covered = acc[3] / 255;
      const i = py * (size * 4 + 1) + 1 + px * 4;
      raw[i] = covered ? Math.round(acc[0] / covered) : 0;
      raw[i + 1] = covered ? Math.round(acc[1] / covered) : 0;
      raw[i + 2] = covered ? Math.round(acc[2] / covered) : 0;
      raw[i + 3] = Math.round(acc[3] / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, { maskable: false }));
writeFileSync('public/icons/icon-512.png', render(512, { maskable: false }));
writeFileSync('public/icons/icon-512-maskable.png', render(512, { maskable: true }));
writeFileSync('public/icons/apple-touch-icon.png', render(180, { maskable: true }));
writeFileSync(
  'public/icons/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#2f5d50"/>
  <rect x="26" y="20" width="48" height="60" rx="5" fill="#fbfaf7"/>
  <rect x="34" y="36" width="32" height="4.5" rx="2" fill="#2f5d50"/>
  <rect x="34" y="48" width="32" height="4.5" rx="2" fill="#2f5d50"/>
  <rect x="34" y="60" width="21" height="4.5" rx="2" fill="#2f5d50"/>
</svg>
`,
);
console.log('Icons generated in public/icons/');
