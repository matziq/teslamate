// All report dates are UTC; $2 is exclusive.
export const SQL = {
  cars: `SELECT id, COALESCE(NULLIF(name, ''), 'Car ' || id) AS name FROM cars ORDER BY name, id`,
  summary: `
    WITH d AS (
      SELECT COUNT(*)::int AS trips, COALESCE(SUM(distance),0)::float8 AS distance_km,
        COALESCE(SUM(duration_min),0)::int AS minutes,
        SUM(distance) FILTER (WHERE start_rated_range_km IS NOT NULL AND end_rated_range_km IS NOT NULL)::float8 AS measured_distance_km,
        SUM(GREATEST(start_rated_range_km-end_rated_range_km,0))::float8 AS range_used_km
      FROM drives WHERE start_date >= $1 AND start_date < $2 AND ($3::int IS NULL OR car_id=$3)
    ), c AS (
      SELECT COUNT(*)::int AS sessions, COALESCE(SUM(charge_energy_added),0)::float8 AS energy_kwh,
        SUM(cost)::float8 AS cost, COUNT(cost)::int AS priced_sessions
      FROM charging_processes WHERE start_date >= $1 AND start_date < $2 AND ($3::int IS NULL OR car_id=$3)
    ) SELECT * FROM d CROSS JOIN c`,
  trips: `
    SELECT d.id, d.car_id, COALESCE(NULLIF(c.name,''),'Car ' || c.id) AS car,
      d.start_date, d.distance::float8, d.duration_min, d.outside_temp_avg::float8 AS temperature_c,
      GREATEST(d.start_rated_range_km-d.end_rated_range_km,0)::float8 AS range_used_km,
      COALESCE(sg.name,sa.name,sa.city,'Unknown') AS origin,
      COALESCE(eg.name,ea.name,ea.city,'Unknown') AS destination
    FROM drives d JOIN cars c ON c.id=d.car_id
    LEFT JOIN addresses sa ON sa.id=d.start_address_id LEFT JOIN addresses ea ON ea.id=d.end_address_id
    LEFT JOIN geofences sg ON sg.id=d.start_geofence_id LEFT JOIN geofences eg ON eg.id=d.end_geofence_id
    WHERE d.start_date >= $1 AND d.start_date < $2 AND ($3::int IS NULL OR d.car_id=$3)
    ORDER BY d.start_date DESC, d.id DESC LIMIT $4`,
  charges: `
    SELECT cp.id, cp.car_id, COALESCE(NULLIF(c.name,''),'Car ' || c.id) AS car,
      cp.start_date, cp.duration_min, cp.charge_energy_added::float8 AS energy_kwh, cp.cost::float8,
      cp.start_battery_level, cp.end_battery_level,
      COALESCE(g.name,a.name,a.city,'Unknown') AS location,
      CASE WHEN g.id=ANY($5::int[]) THEN 'home' ELSE 'other' END AS location_type
    FROM charging_processes cp JOIN cars c ON c.id=cp.car_id
    LEFT JOIN geofences g ON g.id=cp.geofence_id LEFT JOIN addresses a ON a.id=cp.address_id
    WHERE cp.start_date >= $1 AND cp.start_date < $2 AND ($3::int IS NULL OR cp.car_id=$3)
    ORDER BY cp.start_date DESC, cp.id DESC LIMIT $4`,
  chargeTotals: `
    SELECT CASE WHEN geofence_id=ANY($4::int[]) THEN 'home' ELSE 'other' END AS location_type,
      COUNT(*)::int AS sessions, COALESCE(SUM(charge_energy_added),0)::float8 AS energy_kwh,
      SUM(cost)::float8 AS cost, COUNT(cost)::int AS priced_sessions
    FROM charging_processes
    WHERE start_date >= $1 AND start_date < $2 AND ($3::int IS NULL OR car_id=$3)
    GROUP BY 1`,
  daily: `
    SELECT date_trunc('day',start_date)::date::text AS day,
      COALESCE(SUM(distance),0)::float8 AS distance_km,
      SUM(distance) FILTER (WHERE start_rated_range_km IS NOT NULL AND end_rated_range_km IS NOT NULL)::float8 AS measured_distance_km,
      SUM(GREATEST(start_rated_range_km-end_rated_range_km,0))::float8 AS range_used_km,
      AVG(outside_temp_avg)::float8 AS temperature_c
    FROM drives WHERE start_date >= $1 AND start_date < $2 AND ($3::int IS NULL OR car_id=$3)
    GROUP BY 1 ORDER BY 1`,
  parked: `
    WITH events AS (
      SELECT car_id,start_date,end_date,start_rated_range_km,end_rated_range_km
      FROM drives WHERE start_date >= $1::timestamp - interval '7 days' AND start_date < $2 AND ($3::int IS NULL OR car_id=$3)
      UNION ALL
      SELECT car_id,start_date,end_date,start_rated_range_km,end_rated_range_km
      FROM charging_processes WHERE start_date >= $1::timestamp - interval '7 days' AND start_date < $2 AND ($3::int IS NULL OR car_id=$3)
    ), gaps AS (
      SELECT car_id, start_date, start_rated_range_km,
        lag(end_date) OVER w AS previous_end,
        lag(end_rated_range_km) OVER w AS previous_range
      FROM events WINDOW w AS (PARTITION BY car_id ORDER BY start_date)
    )
    SELECT COUNT(*)::int AS periods,
      SUM(GREATEST(previous_range-start_rated_range_km,0))::float8 AS lost_range_km,
      SUM(EXTRACT(EPOCH FROM (start_date-previous_end))/3600)::float8 AS hours
    FROM gaps WHERE start_date >= $1 AND start_date < $2 AND previous_end IS NOT NULL
      AND start_date-previous_end >= interval '2 hours'
      AND previous_range IS NOT NULL AND start_rated_range_km IS NOT NULL`,
  battery: `
    WITH samples AS (
      SELECT car_id, end_date,
        (end_rated_range_km * 100.0 / end_battery_level)::float8 AS full_range_km,
        ROW_NUMBER() OVER (PARTITION BY car_id ORDER BY end_date ASC, id ASC) AS first,
        ROW_NUMBER() OVER (PARTITION BY car_id ORDER BY end_date DESC, id DESC) AS last
      FROM charging_processes
      WHERE end_date >= $1 AND end_date < $2 AND ($3::int IS NULL OR car_id=$3)
        AND end_battery_level BETWEEN 50 AND 100 AND end_rated_range_km > 0
    )
    SELECT s.car_id, COALESCE(NULLIF(c.name,''),'Car ' || c.id) AS car,
      MAX(full_range_km) FILTER (WHERE first=1) AS first_km,
      MAX(full_range_km) FILTER (WHERE last=1) AS latest_km,
      MAX(end_date) FILTER (WHERE first=1) AS first_date,
      MAX(end_date) FILTER (WHERE last=1) AS latest_date
    FROM samples s JOIN cars c ON c.id=s.car_id WHERE first=1 OR last=1
    GROUP BY s.car_id,c.id,c.name ORDER BY car`,
};

export function queryValues(report, p, homeIds = []) {
  const common = [p.from, p.to, p.carId];
  if (report === "trips") return [...common, p.limit];
  if (report === "charges") return [...common, p.limit, homeIds];
  if (report === "chargeTotals") return [...common, homeIds];
  return common;
}
