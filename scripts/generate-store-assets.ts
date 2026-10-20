import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const output = join(process.cwd(), "assets", "store");
mkdirSync(output, { recursive: true });

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (data: Buffer) => {
  let value = 0xffffffff;
  for (const byte of data)
    value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const label = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, checksum]);
};
const png = (width: number, height: number, pixels: Uint8Array) => {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const target = y * (width * 4 + 1);
    scanlines[target] = 0;
    Buffer.from(
      pixels.buffer,
      pixels.byteOffset + y * width * 4,
      width * 4,
    ).copy(scanlines, target + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};
const canvas = (width: number, height: number) =>
  new Uint8Array(width * height * 4);
const paint = (
  pixels: Uint8Array,
  width: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) => {
  if (x < 0 || y < 0 || x >= width) return;
  const index = (y * width + x) * 4;
  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = a;
};
const roundedRect = (
  pixels: Uint8Array,
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
  color: readonly [number, number, number],
) => {
  for (let y = Math.max(0, top); y < Math.min(height, bottom); y += 1)
    for (let x = Math.max(0, left); x < Math.min(width, right); x += 1) {
      const nearX = Math.max(left + radius - x, x - (right - radius - 1), 0);
      const nearY = Math.max(top + radius - y, y - (bottom - radius - 1), 0);
      if (nearX * nearX + nearY * nearY <= radius * radius)
        paint(pixels, width, x, y, ...color);
    }
};
const icon = (size: number) => {
  const pixels = canvas(size, size);
  const scale = size / 256;
  const unit = (value: number) => Math.round(value * scale);
  roundedRect(pixels, size, size, 0, 0, size, size, unit(46), [10, 18, 50]);
  for (let y = unit(28); y < unit(228); y += 1)
    for (let x = unit(28); x < unit(228); x += 1) {
      const dx = x - unit(128),
        dy = y - unit(128);
      if (
        dx * dx + dy * dy < unit(83) ** 2 &&
        dx * dx + dy * dy > unit(64) ** 2
      )
        paint(pixels, size, x, y, 75, 113, 255);
    }
  roundedRect(
    pixels,
    size,
    size,
    unit(82),
    unit(74),
    unit(174),
    unit(183),
    unit(14),
    [24, 37, 83],
  );
  roundedRect(
    pixels,
    size,
    size,
    unit(82),
    unit(74),
    unit(174),
    unit(99),
    unit(14),
    [139, 92, 246],
  );
  roundedRect(
    pixels,
    size,
    size,
    unit(97),
    unit(115),
    unit(128),
    unit(126),
    unit(5),
    [125, 211, 252],
  );
  roundedRect(
    pixels,
    size,
    size,
    unit(97),
    unit(137),
    unit(147),
    unit(148),
    unit(5),
    [125, 211, 252],
  );
  roundedRect(
    pixels,
    size,
    size,
    unit(97),
    unit(159),
    unit(119),
    unit(170),
    unit(5),
    [125, 211, 252],
  );
  for (let t = 0; t < unit(46); t += 1) {
    paint(
      pixels,
      size,
      unit(110) + t,
      unit(179) - Math.floor(t * 0.7),
      255,
      255,
      255,
    );
    paint(
      pixels,
      size,
      unit(110) + t,
      unit(180) - Math.floor(t * 0.7),
      255,
      255,
      255,
    );
  }
  for (let t = 0; t < unit(25); t += 1) {
    paint(pixels, size, unit(92) + t, unit(164) + t, 255, 255, 255);
    paint(pixels, size, unit(92) + t, unit(165) + t, 255, 255, 255);
  }
  return png(size, size, pixels);
};
const carousel = () => {
  const width = 600,
    height = 900,
    pixels = canvas(width, height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const glow = Math.max(0, 1 - Math.hypot(x - 475, y - 170) / 560);
      paint(
        pixels,
        width,
        x,
        y,
        7 + Math.floor(glow * 17),
        15 + Math.floor(glow * 23),
        42 + Math.floor(glow * 55),
      );
    }
  roundedRect(pixels, width, height, 55, 155, 545, 700, 32, [18, 31, 72]);
  roundedRect(pixels, width, height, 55, 155, 545, 230, 32, [79, 70, 229]);
  roundedRect(pixels, width, height, 90, 270, 510, 335, 20, [32, 52, 111]);
  roundedRect(pixels, width, height, 90, 365, 510, 430, 20, [32, 52, 111]);
  roundedRect(pixels, width, height, 90, 460, 510, 525, 20, [32, 52, 111]);
  roundedRect(pixels, width, height, 90, 555, 395, 620, 20, [32, 52, 111]);
  roundedRect(pixels, width, height, 415, 555, 510, 620, 20, [47, 202, 152]);
  for (let x = 110; x < 475; x += 52)
    roundedRect(pixels, width, height, x, 285, x + 32, 300, 7, [126, 211, 252]);
  for (let x = 110; x < 410; x += 52)
    roundedRect(pixels, width, height, x, 380, x + 32, 395, 7, [126, 211, 252]);
  for (let x = 110; x < 450; x += 52)
    roundedRect(pixels, width, height, x, 475, x + 32, 490, 7, [126, 211, 252]);
  return png(width, height, pixels);
};

for (const size of [64, 72, 88, 126, 180, 241])
  writeFileSync(join(output, `icon-${size}x${size}.png`), icon(size));
writeFileSync(join(output, "carousel-600x900.png"), carousel());
console.log(`Generated Amazon store assets in ${output}`);
