import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "android"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (entry.name.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", path], {
        stdio: "inherit",
      });
      if (result.status !== 0) throw new Error(`Syntax check failed: ${path}`);
    }
  }
}
await check(root);
console.log("JavaScript syntax checks passed.");
