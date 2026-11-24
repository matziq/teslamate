export function reportService(repo) {
  return {
    cars: () => repo.cars(),
    async summary(p) { return (await repo.report("summary", p))[0]; },
    trips: p => repo.report("trips", p),
    async charging(p) {
      const [sessions, totals] = await Promise.all([repo.report("charges", p), repo.report("chargeTotals", p)]);
      return { sessions, totals };
    },
    async trends(p) {
      const [daily, parked, battery] = await Promise.all([repo.report("daily", p), repo.report("parked", p), repo.report("battery", p)]);
      return { daily, parked: parked[0], battery };
    }
  };
}
