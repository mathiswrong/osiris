import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url);
const publicPath = (filename) => fileURLToPath(new URL(filename, publicDir));
const artworkPath = fileURLToPath(
  new URL("../assets/brand/knuckletat-og-artwork.png", import.meta.url),
);
const logoPath = publicPath("knuckle-tat-logo-single-line.png");
const fistPath = publicPath("knuckle-tat-icon.png");

const canvas = { width: 1200, height: 630 };
const logo = await sharp(logoPath)
  .extract({ left: 107, top: 141, width: 1850, height: 476 })
  .resize({ width: 560 })
  .png()
  .toBuffer();

const cardText = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect x="66" y="398" width="32" height="4" fill="#a04b32"/>
  <text x="66" y="451" fill="#18313b" font-family="Arial, sans-serif" font-size="25" font-weight="600" letter-spacing="2">aggregated open source intel.</text>
  <path d="M66 473H557" stroke="#18313b" stroke-opacity=".42" stroke-width="1"/>
  <text x="66" y="516" fill="#44616b" font-family="Arial, sans-serif" font-size="15" letter-spacing="3.5">OPEN SOURCES  /  GLOBAL SIGNALS</text>
</svg>`);

await sharp(artworkPath)
  .resize(canvas.width, canvas.height, { fit: "cover" })
  .composite([
    { input: logo, left: 43, top: 198 },
    { input: cardText, left: 0, top: 0 },
  ])
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
