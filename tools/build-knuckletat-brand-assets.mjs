import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url);
const publicPath = (filename) => fileURLToPath(new URL(filename, publicDir));
const logoPath = publicPath("knuckle-tat-logo-single-line.png");
const fistPath = publicPath("knuckle-tat-icon.png");

const canvas = { width: 1200, height: 630 };
const tightLogo = await sharp(logoPath)
  .trim()
  .png()
  .toBuffer();
await writeFile(publicPath("knuckletat-logo-tight.png"), tightLogo);
const ogLogo = await sharp(tightLogo)
  .resize({ width: 1020 })
  .png()
  .toBuffer();

const cardText = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <text x="390" y="448" fill="#000" font-family="JetBrains Mono, Menlo, monospace" font-size="34" font-weight="700" letter-spacing="0.2">aggregated open source intel</text>
</svg>`);

const ogCard = await sharp({ create: { ...canvas, channels: 4, background: "white" } })
  .composite([
    { input: ogLogo, left: 90, top: 185 },
    { input: cardText, left: 0, top: 0 },
  ])
  .png()
  .toBuffer();
await sharp(ogCard)
  .grayscale()
  .png({ compressionLevel: 9 })
  .toFile(publicPath("knuckletat-og.png"));

const iconBackground = Buffer.from(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="90" fill="#172f3a"/>
  <rect x="12" y="12" width="488" height="488" rx="78" fill="none" stroke="#d9cbb7" stroke-width="6"/>
</svg>`);
const fist = await sharp(fistPath).resize(440, 440).png().toBuffer();
const icon = await sharp(iconBackground)
  .composite([{ input: fist, left: 36, top: 36 }])
  .png()
  .toBuffer();

for (const size of [16, 32, 180, 192, 512]) {
  const filename =
    size === 180
      ? "apple-touch-icon.png"
      : size === 192 || size === 512
        ? `knuckletat-icon-${size}.png`
        : `favicon-${size}x${size}.png`;
  await sharp(icon).resize(size, size).png().toFile(publicPath(filename));
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map((size) => sharp(icon).resize(size, size).png().toBuffer()),
);
const icoHeader = Buffer.alloc(6 + icoSizes.length * 16);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(icoSizes.length, 4);
let imageOffset = icoHeader.length;
for (const [index, image] of icoImages.entries()) {
  const entryOffset = 6 + index * 16;
  icoHeader.writeUInt8(icoSizes[index], entryOffset);
  icoHeader.writeUInt8(icoSizes[index], entryOffset + 1);
  icoHeader.writeUInt16LE(1, entryOffset + 4);
  icoHeader.writeUInt16LE(32, entryOffset + 6);
  icoHeader.writeUInt32LE(image.length, entryOffset + 8);
  icoHeader.writeUInt32LE(imageOffset, entryOffset + 12);
  imageOffset += image.length;
}
await writeFile(publicPath("favicon.ico"), Buffer.concat([icoHeader, ...icoImages]));

const faviconPng = await readFile(publicPath("knuckletat-icon-512.png"));
await writeFile(
  publicPath("favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${faviconPng.toString("base64")}"/></svg>\n`,
);
