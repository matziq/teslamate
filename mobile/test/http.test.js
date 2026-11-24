import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createHandler, configFromEnv } from "../server/index.js";
import { demoRepository } from "../server/demo.js";

test("HTTP health, readiness, report, and invalid input", async t => {
  const config = configFromEnv({ TESLAMATE_MOBILE_DEMO:"true" });
  const server = createServer(createHandler(config,demoRepository(),{ error() {} }));
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/mobile`;
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { status:"ok", mode:"demo" });
  assert.equal((await fetch(`${base}/api/ready`)).status,200);
  assert.equal((await fetch(`${base}/api/trips?carId=bad`)).status,400);
  assert.equal((await fetch(`${base}/api/unknown`)).status,404);
  assert.match((await fetch(`${base}/`)).headers.get("content-security-policy"), /frame-ancestors 'none'/);
});
test("invalid configuration fails rather than falling back", () => {
  assert.throws(() => configFromEnv({ TESLAMATE_MOBILE_DEMO:"false" }), /PGUSER/);
  assert.throws(() => configFromEnv({ TESLAMATE_MOBILE_DEMO:"true", HOME_GEOFENCE_IDS:"1,bad" }), /HOME_GEOFENCE_IDS/);
});
