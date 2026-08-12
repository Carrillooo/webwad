// Generates PNG icons from the source SVG. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/icons/icon.svg"));
const out = (name) => join(root, "public/icons", name);

const maskableSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
     <rect width="512" height="512" fill="#05060c"/>
     <g transform="translate(51.2,51.2) scale(0.8)">${svg
       .toString()
       .replace(/<\?xml.*?\?>/, "")
       .replace(/<svg[^>]*>/, "")
       .replace(/<\/svg>/, "")}</g>
   </svg>`,
);

const jobs = [
  { src: svg, size: 192, name: "icon-192.png" },
  { src: svg, size: 512, name: "icon-512.png" },
  { src: svg, size: 180, name: "apple-touch-icon.png" },
  { src: maskableSvg, size: 512, name: "maskable-512.png" },
];

for (const j of jobs) {
  await sharp(j.src).resize(j.size, j.size).png().toFile(out(j.name));
  console.log("wrote", j.name);
}
