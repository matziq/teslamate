import test from "node:test";
import assert from "node:assert/strict";
import { reportParams } from "../server/input.js";
import { queryValues } from "../server/queries.js";

const now = new Date("2026-11-24T12:00:00Z");
test("range is inclusive by day and bounded by an exclusive UTC end", () => {
  const result = reportParams(
    new URLSearchParams("from=2026-02-01&to=2026-02-28&carId=3&limit=5"),
    now,
  );
  assert.deepEqual(result, {
    from: "2026-02-01T00:00:00.000Z",
    to: "2026-03-01T00:00:00.000Z",
    carId: 3,
    limit: 5,
    days: 28,
  });
  assert.deepEqual(queryValues("charges", result, [7]), [
    result.from,
    result.to,
    3,
    5,
    [7],
  ]);
});
test("invalid dates, ranges, ids, and limits are rejected", () => {
  for (const query of [
    "from=2026-02-30",
    "from=2026-03-02&to=2026-03-01",
    "from=2020-01-01&to=2026-01-01",
    "carId=1%20OR%201%3D1",
    "limit=2x",
    "limit=101",
  ]) {
    assert.throws(
      () => reportParams(new URLSearchParams(query), now),
      RangeError,
    );
  }
});
