import test from "node:test";
import assert from "node:assert/strict";
import { reportService } from "../server/service.js";
import { demoRepository } from "../server/demo.js";
import { reportParams } from "../server/input.js";

test("charging totals are independent of the recent-session limit", async () => {
  const calls = [];
  const service = reportService({
    report: async (name, p) => {
      calls.push([name, p.limit]);
      return name === "charges"
        ? [{ id: 1 }]
        : [{ location_type: "home", sessions: 12 }];
    },
  });
  const result = await service.charging({ limit: 1 });
  assert.deepEqual(calls, [
    ["charges", 1],
    ["chargeTotals", 1],
  ]);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.totals[0].sessions, 12);
});
test("demo mode filters dates and selected vehicle", async () => {
  const repo = demoRepository(),
    p = reportParams(new URLSearchParams("carId=1&limit=1"));
  const summary = (await repo.report("summary", p))[0];
  assert.equal(summary.trips, 1);
  assert.equal((await repo.report("trips", p)).length, 1);
  const empty = {
    ...p,
    from: "2000-01-01T00:00:00.000Z",
    to: "2000-01-02T00:00:00.000Z",
  };
  assert.equal((await repo.report("summary", empty))[0].trips, 0);
});
