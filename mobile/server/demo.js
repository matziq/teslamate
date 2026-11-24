const cars = [
  { id: 1, name: "Midnight" },
  { id: 2, name: "Roadrunner" },
  { id: 3, name: "Sparky" },
];
const day = (offset, hour = 12) => {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString();
};
const trips = [
  {
    id: 1,
    car_id: 1,
    car: "Midnight",
    start_date: day(0),
    distance: 38.6,
    duration_min: 42,
    temperature_c: 20,
    range_used_km: 42,
    origin: "Home",
    destination: "Downtown",
  },
  {
    id: 2,
    car_id: 2,
    car: "Roadrunner",
    start_date: day(1),
    distance: 21.3,
    duration_min: 29,
    temperature_c: 12,
    range_used_km: 24,
    origin: "Home",
    destination: "Airport",
  },
  {
    id: 3,
    car_id: 3,
    car: "Sparky",
    start_date: day(2),
    distance: 12.8,
    duration_min: 18,
    temperature_c: 17,
    range_used_km: 14,
    origin: "Work",
    destination: "Home",
  },
];
const charges = [
  {
    id: 1,
    car_id: 1,
    car: "Midnight",
    start_date: day(0, 3),
    duration_min: 238,
    energy_kwh: 28.4,
    cost: 3.27,
    location: "Home",
    location_type: "home",
  },
  {
    id: 2,
    car_id: 2,
    car: "Roadrunner",
    start_date: day(1),
    duration_min: 42,
    energy_kwh: 18.7,
    cost: 8.52,
    location: "Supercharger",
    location_type: "other",
  },
  {
    id: 3,
    car_id: 3,
    car: "Sparky",
    start_date: day(3),
    duration_min: 180,
    energy_kwh: 22.1,
    cost: null,
    location: "Home",
    location_type: "home",
  },
];
const select = (items, p) =>
  items.filter(
    (x) =>
      (!p.carId || x.car_id === p.carId) &&
      x.start_date >= p.from &&
      x.start_date < p.to,
  );
export function demoRepository() {
  return {
    async ready() {
      return true;
    },
    async close() {},
    async cars() {
      return cars;
    },
    async report(name, p) {
      const d = select(trips, p),
        c = select(charges, p);
      if (name === "trips") return d.slice(0, p.limit);
      if (name === "charges") return c.slice(0, p.limit);
      if (name === "summary")
        return [
          {
            trips: d.length,
            distance_km: d.reduce((s, x) => s + x.distance, 0),
            measured_distance_km: d.reduce((s, x) => s + x.distance, 0),
            minutes: d.reduce((s, x) => s + x.duration_min, 0),
            range_used_km: d.reduce((s, x) => s + x.range_used_km, 0),
            sessions: c.length,
            energy_kwh: c.reduce((s, x) => s + x.energy_kwh, 0),
            cost: c.some((x) => x.cost !== null)
              ? c.reduce((s, x) => s + (x.cost ?? 0), 0)
              : null,
            priced_sessions: c.filter((x) => x.cost !== null).length,
          },
        ];
      if (name === "chargeTotals")
        return ["home", "other"].map((type) => {
          const items = c.filter((x) => x.location_type === type);
          return {
            location_type: type,
            sessions: items.length,
            energy_kwh: items.reduce((s, x) => s + x.energy_kwh, 0),
            cost: items.some((x) => x.cost !== null)
              ? items.reduce((s, x) => s + (x.cost ?? 0), 0)
              : null,
            priced_sessions: items.filter((x) => x.cost !== null).length,
          };
        });
      if (name === "daily")
        return d
          .map((x) => ({
            day: x.start_date.slice(0, 10),
            distance_km: x.distance,
            measured_distance_km: x.distance,
            range_used_km: x.range_used_km,
            temperature_c: x.temperature_c,
          }))
          .reverse();
      if (name === "parked")
        return [
          {
            periods: d.length,
            lost_range_km: d.length ? 4.8 : null,
            hours: d.length ? 72 : null,
          },
        ];
      if (name === "battery")
        return cars
          .filter(
            (x) =>
              (!p.carId || x.id === p.carId) &&
              c.some((charge) => charge.car_id === x.id),
          )
          .map((x) => ({
            car_id: x.id,
            car: x.name,
            first_km: 490,
            latest_km: 475,
            first_date: c.find((charge) => charge.car_id === x.id).start_date,
            latest_date: c.find((charge) => charge.car_id === x.id).start_date,
          }));
      throw new Error(`Unknown report: ${name}`);
    },
  };
}
