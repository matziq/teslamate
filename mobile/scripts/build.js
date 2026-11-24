import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "dist");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of ["server", "public", "package.json", "package-lock.json"]) {
  await cp(join(root, item), join(out, item), { recursive: true });
}
console.log("Built production files in dist/.");
