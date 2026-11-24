import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { reportParams } from "./input.js";
import { demoRepository } from "./demo.js";
import { databaseRepository } from "./repository.js";
import { reportService } from "./service.js";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

export function configFromEnv(env) {
  const integer = (name, fallback, min, max) => {
    const raw = env[name] ?? String(fallback);
    if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) throw new Error(`${name} must be ${min}–${max}`);
    return Number(raw);
  };
  const bool = (name, fallback) => {
    const value = env[name] ?? String(fallback);
    if (!["true", "false"].includes(value)) throw new Error(`${name} must be true or false`);
    return value === "true";
  };
  const demo = bool("TESLAMATE_MOBILE_DEMO", false);
  const home = env.HOME_GEOFENCE_IDS ?? "";
  if (home && !/^[1-9]\d*(,[1-9]\d*)*$/.test(home)) throw new Error("HOME_GEOFENCE_IDS must be comma-separated positive IDs");
  const homeIds = home ? home.split(",").map(Number) : [];
  if (homeIds.some(id => !Number.isSafeInteger(id) || id > 2147483647)) throw new Error("HOME_GEOFENCE_IDS contains an invalid ID");
  if (!demo && (!env.PGUSER || !env.PGPASSWORD)) throw new Error("PGUSER and PGPASSWORD are required outside demo mode");
  return {
    demo, homeIds, listenPort: integer("PORT", 4000, 1, 65535),
    maxDays: integer("MAX_RANGE_DAYS", 366, 1, 366),
    host: env.PGHOST ?? "database", port: integer("PGPORT", 5432, 1, 65535),
    database: env.PGDATABASE ?? "teslamate", user: env.PGUSER, password: env.PGPASSWORD,
    poolSize: integer("DB_POOL_MAX", 4, 1, 10), ssl: bool("DATABASE_SSL", false)
  };
}

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
}

export function createHandler(config, repo, logger = console) {
  const service = reportService(repo);
  return async (req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/mobile/api/health") return json(res, 200, { status: "ok", mode: config.demo ? "demo" : "database" });
      if (url.pathname === "/mobile/api/ready") {
        try { await repo.ready(); return json(res, 200, { status: "ready" }); }
        catch (error) { logger.error("Readiness failed:", error.message); return json(res, 503, { status: "not_ready" }); }
      }
      if (url.pathname === "/mobile/api/cars") return json(res, 200, await service.cars());
      const endpoint = url.pathname.match(/^\/mobile\/api\/(summary|trips|charging|trends)$/);
      if (endpoint) return json(res, 200, await service[endpoint[1]](reportParams(url.searchParams, new Date(), config.maxDays)));
      if (url.pathname.startsWith("/mobile/api/")) return json(res, 404, { error: "Not found" });
      if (url.pathname === "/mobile") { res.writeHead(308, { Location: "/mobile/" }); return res.end(); }
      if (!url.pathname.startsWith("/mobile/")) return json(res, 404, { error: "Not found" });
      const path = decodeURIComponent(url.pathname.slice("/mobile/".length)) || "index.html";
      const file = resolve(publicDir, path);
      if (!file.startsWith(`${publicDir}${sep}`)) return json(res, 404, { error: "Not found" });
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
        "Cache-Control": path === "index.html" || path === "sw.js" ? "no-cache" : "public, max-age=3600",
        "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"
      });
      return res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      if (error instanceof RangeError || error instanceof URIError) return json(res, 400, { error: error.message });
      if (error.code === "ENOENT" || error.code === "EISDIR") return json(res, 404, { error: "Not found" });
      logger.error("Request failed:", error.message);
      return json(res, 500, { error: "Unable to load report" });
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = configFromEnv(process.env);
  const repo = config.demo ? demoRepository() : databaseRepository(config);
  const server = createServer(createHandler(config, repo));
  server.listen(config.listenPort, "0.0.0.0", () => console.log(`TeslaMate Mobile listening on ${config.listenPort} (${config.demo ? "demo" : "database"})`));
  const shutdown = () => {
    server.close(async () => { await repo.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
