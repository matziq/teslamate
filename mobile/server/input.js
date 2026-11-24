const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;

function day(value, name) {
  if (!DATE.test(value)) throw new RangeError(`${name} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`${name} is not a valid date`);
  }
  return date;
}

export function reportParams(params, now = new Date(), maxDays = 366) {
  const today = now.toISOString().slice(0, 10);
  const lastMonth = new Date(day(today, "today").getTime() - 29 * DAY).toISOString().slice(0, 10);
  const from = day(params.get("from") ?? lastMonth, "from");
  const to = day(params.get("to") ?? today, "to");
  const days = (to - from) / DAY + 1;
  if (days < 1 || days > maxDays) throw new RangeError(`Range must be between 1 and ${maxDays} days`);
  const rawId = params.get("carId");
  let carId = null;
  if (rawId !== null && rawId !== "all") {
    if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) > 2147483647) {
      throw new RangeError("carId must be a positive integer or all");
    }
    carId = Number(rawId);
  }
  const rawLimit = params.get("limit") ?? "20";
  if (!/^[1-9]\d*$/.test(rawLimit) || Number(rawLimit) > 100) throw new RangeError("limit must be 1–100");
  return { from: from.toISOString(), to: new Date(to.getTime() + DAY).toISOString(), carId, limit: Number(rawLimit), days };
}
