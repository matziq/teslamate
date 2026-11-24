import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { SQL, queryValues } from "../server/queries.js";

test("report SQL executes on PostgreSQL and aggregates full ranges", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE cars (id int PRIMARY KEY, name text);
    CREATE TABLE addresses (id int PRIMARY KEY, name text, city text);
    CREATE TABLE geofences (id int PRIMARY KEY, name text);
    CREATE TABLE drives (id int PRIMARY KEY, car_id int, start_date timestamp, end_date timestamp,
      distance double precision, duration_min int, outside_temp_avg numeric,
      start_rated_range_km numeric, end_rated_range_km numeric,
      start_address_id int, end_address_id int, start_geofence_id int, end_geofence_id int);
    CREATE TABLE charging_processes (id int PRIMARY KEY, car_id int, start_date timestamp,
      end_date timestamp, duration_min int, charge_energy_added numeric, cost numeric,
      start_battery_level int, end_battery_level int, start_rated_range_km numeric,
      end_rated_range_km numeric, address_id int, geofence_id int);
    INSERT INTO cars VALUES (1,'Car A'),(2,'Car B');
    INSERT INTO geofences VALUES (7,'Home');
    INSERT INTO drives VALUES
      (1,1,'2026-01-01 09:00','2026-01-01 10:00',20,60,10,200,175,NULL,NULL,7,NULL),
      (2,1,'2026-01-03 09:00','2026-01-03 10:00',10,60,15,NULL,NULL,NULL,NULL,NULL,7),
      (3,2,'2026-01-01 09:00','2026-01-01 10:00',100,60,20,300,200,NULL,NULL,NULL,NULL);
    INSERT INTO charging_processes VALUES
      (1,1,'2026-01-02 09:00','2026-01-02 10:00',60,20,4,50,80,170,270,NULL,7),
      (2,1,'2026-01-04 09:00','2026-01-04 10:00',60,10,NULL,50,80,150,260,NULL,NULL);
  `);
  const p = {
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-01-05T00:00:00.000Z",
    carId: 1,
    limit: 1,
  };
  const run = (name) => db.query(SQL[name], queryValues(name, p, [7]));
  assert.equal((await db.query(SQL.cars)).rows.length, 2);
  const summary = (await run("summary")).rows[0];
  assert.equal(summary.trips, 2);
  assert.equal(summary.distance_km, 30);
  assert.equal(summary.measured_distance_km, 20);
  assert.equal(summary.range_used_km, 25);
  assert.equal(summary.priced_sessions, 1);
  assert.equal((await run("trips")).rows.length, 1);
  assert.equal((await run("charges")).rows.length, 1);
  const totals = (await run("chargeTotals")).rows;
  assert.equal(
    totals.reduce((sum, row) => sum + row.sessions, 0),
    2,
  );
  assert.equal(
    totals.find((row) => row.location_type === "home").energy_kwh,
    20,
  );
  assert.equal((await run("daily")).rows.length, 2);
  const parked = (await run("parked")).rows[0];
  assert.equal(parked.periods, 1);
  assert.equal(parked.lost_range_km, 5);
  const battery = (await run("battery")).rows[0];
  assert.equal(battery.first_km, 337.5);
  assert.equal(battery.latest_km, 325);
});
