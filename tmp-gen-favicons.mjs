import sharp from "sharp";
import fs from "fs";

// Regenera icon.png (32), apple-icon.png (180) y favicon.ico (16) desde app/icon.svg.
// sharp de esta versión no escribe .ico: se embebe un PNG 16x16 en formato ICO (Vista+).
const svg = "app/icon.svg";

const png32 = await sharp(svg).resize(32, 32).png().toBuffer();
fs.writeFileSync("app/icon.png", png32);

const png180 = await sharp(svg).resize(180, 180).png().toBuffer();
fs.writeFileSync("app/apple-icon.png", png180);

const png16 = await sharp(svg).resize(16, 16).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count: 1
header.writeUInt8(16, 6); // width
header.writeUInt8(16, 7); // height
header.writeUInt8(0, 8); // colorCount
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // planes
header.writeUInt16LE(32, 12); // bitCount
header.writeUInt32LE(png16.length, 14); // bytesInRes
header.writeUInt32LE(22, 18); // imageOffset
fs.writeFileSync("app/favicon.ico", Buffer.concat([header, png16]));

// PNG de la galería (para que coincidan con el activo transparente)
const pP32 = await sharp("favicons/p-transparente.svg").resize(32, 32).png().toBuffer();
fs.writeFileSync("favicons/preview/p.png", pP32);
const pP16 = await sharp("favicons/p-transparente.svg").resize(16, 16).png().toBuffer();
fs.writeFileSync("favicons/preview/p-16.png", pP16);

for (const f of ["app/icon.png", "app/apple-icon.png", "app/favicon.ico"]) {
  console.log(f, fs.statSync(f).size, "bytes");
}
