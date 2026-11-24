const $ = (selector) => document.querySelector(selector);
const state = { car: "all", days: 30, view: "today", sequence: 0 };
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  value == null ? "Not recorded" : currency.format(value);
const qty = (value) => (value == null ? "—" : number.format(value));
const metric = (label, value, note = "") =>
  `<article class="metric"><span>${escape(label)}</span><strong>${escape(value)}</strong>${note ? `<small>${escape(note)}</small>` : ""}</article>`;
const empty = (text) => `<p class="empty">${escape(text)}</p>`;

async function api(endpoint, days = state.days, limit = 100) {
  const to = new Date();
  const from = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - days + 1),
  );
  const params = new URLSearchParams({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    carId: state.car,
    limit: String(limit),
  });
  const response = await fetch(`/mobile/api/${endpoint}?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error((await response.json()).error || `HTTP ${response.status}`);
  return response.json();
}

const tripItem = (x) =>
  `<article class="item"><div><h3>${escape(x.origin)} → ${escape(x.destination)}</h3><p>${date.format(new Date(x.start_date))} · ${escape(x.car)} · ${qty(x.duration_min)} min</p></div><div class="value"><strong>${qty(x.distance)} km</strong><small>${x.temperature_c == null ? "Temp unavailable" : `${qty(x.temperature_c)}°C`}</small></div></article>`;
const chargeItem = (x) =>
  `<article class="item"><div><h3>${escape(x.location)}</h3><p>${date.format(new Date(x.start_date))} · ${escape(x.car)} · ${qty(x.duration_min)} min</p></div><div class="value"><strong>${qty(x.energy_kwh)} kWh</strong><small>${escape(money(x.cost))}</small></div></article>`;

async function renderToday() {
  const [summary, trips] = await Promise.all([
    api("summary", 1),
    api("trips", 30, 3),
  ]);
  return () => {
    $("#todayMetrics").innerHTML =
      metric(
        "Distance",
        `${qty(summary.distance_km)} km`,
        `${summary.trips} trips`,
      ) +
      metric("Drive time", `${qty(summary.minutes)} min`) +
      metric(
        "Charged",
        `${qty(summary.energy_kwh)} kWh`,
        `${summary.sessions} sessions`,
      ) +
      metric(
        "Recorded cost",
        money(summary.cost),
        `${summary.priced_sessions} priced sessions`,
      );
    $("#recentTrips").innerHTML = trips.length
      ? trips.map(tripItem).join("")
      : empty("No recent trips.");
  };
}
async function renderTrips() {
  const [summary, trips] = await Promise.all([api("summary"), api("trips")]);
  return () => {
    const efficiency =
      summary.range_used_km > 0 && summary.measured_distance_km != null
        ? `${qty((summary.measured_distance_km / summary.range_used_km) * 100)}%`
        : "—";
    $("#tripMetrics").innerHTML =
      metric("Trips", summary.trips) +
      metric("Distance", `${qty(summary.distance_km)} km`) +
      metric("Driving", `${qty(summary.minutes)} min`) +
      metric("Range efficiency", efficiency, "distance / rated range used");
    $("#tripList").innerHTML = trips.length
      ? trips.map(tripItem).join("")
      : empty("No trips in this period.");
  };
}
async function renderCharging() {
  const report = await api("charging");
  return () => {
    const home = report.totals.find((x) => x.location_type === "home") ?? {
      sessions: 0,
      energy_kwh: 0,
      cost: null,
      priced_sessions: 0,
    };
    const other = report.totals.find((x) => x.location_type === "other") ?? {
      sessions: 0,
      energy_kwh: 0,
      cost: null,
      priced_sessions: 0,
    };
    const energy = Number(home.energy_kwh) + Number(other.energy_kwh);
    const priced = home.priced_sessions + other.priced_sessions;
    const cost = priced
      ? Number(home.cost ?? 0) + Number(other.cost ?? 0)
      : null;
    $("#chargeMetrics").innerHTML =
      metric("Energy added", `${qty(energy)} kWh`) +
      metric("Recorded cost", money(cost), `${priced} priced sessions`) +
      metric("Sessions", home.sessions + other.sessions) +
      metric("Period", `${state.days} days`, "UTC");
    $("#chargeSplit").innerHTML = [home, other]
      .map(
        (x, i) =>
          `<div><strong>${i ? "Other" : "Home"} · ${x.sessions}</strong><span>${qty(x.energy_kwh)} kWh</span><p class="hint">${escape(money(x.cost))} · ${x.priced_sessions} priced</p></div>`,
      )
      .join("");
    $("#chargeList").innerHTML = report.sessions.length
      ? report.sessions.map(chargeItem).join("")
      : empty("No charging sessions in this period.");
  };
}
async function renderTrends() {
  const report = await api("trends");
  return () => {
    $("#daily").innerHTML = report.daily.length
      ? report.daily
          .slice(-14)
          .reverse()
          .map(
            (x) =>
              `<article class="item"><div><h3>${escape(x.day)}</h3><p>${x.temperature_c == null ? "Temperature unavailable" : `${qty(x.temperature_c)}°C average`} · ${qty(x.distance_km)} km</p></div><div class="value"><strong>${x.range_used_km > 0 && x.measured_distance_km != null ? `${qty((x.measured_distance_km / x.range_used_km) * 100)}%` : "—"}</strong><small>range efficiency</small></div></article>`,
          )
          .join("")
      : empty("No driving data in this period.");
    const parked = report.parked;
    const rate =
      parked.hours > 0 ? (parked.lost_range_km / parked.hours) * 24 : null;
    $("#trendMetrics").innerHTML =
      metric(
        "Parked range loss",
        parked.lost_range_km == null ? "—" : `${qty(parked.lost_range_km)} km`,
        "estimated between events",
      ) +
      metric("Loss per day parked", rate == null ? "—" : `${qty(rate)} km`) +
      metric("Park periods", parked.periods, "2+ hours") +
      metric("Period", `${state.days} days`, "UTC");
    $("#battery").innerHTML = report.battery.length
      ? report.battery
          .map(
            (x) =>
              `<article class="item"><div><h3>${escape(x.car)}</h3><p>${date.format(new Date(x.first_date))} → ${date.format(new Date(x.latest_date))}</p></div><div class="value"><strong>${qty(x.latest_km)} km</strong><small>${qty(x.first_km)} km first sample</small></div></article>`,
          )
          .join("")
      : empty("No qualifying charging samples.");
  };
}
const loaders = {
  today: renderToday,
  trips: renderTrips,
  charging: renderCharging,
  trends: renderTrends,
};
async function show(view) {
  state.view = view;
  const sequence = ++state.sequence;
  document.querySelectorAll(".view").forEach((x) => {
    x.hidden = x.id !== view;
  });
  document.querySelectorAll("[data-view]").forEach((x) => {
    const active = x.dataset.view === view;
    x.classList.toggle("active", active);
    if (active) x.setAttribute("aria-current", "page");
    else x.removeAttribute("aria-current");
  });
  $("#title").textContent = view[0].toUpperCase() + view.slice(1);
  $("#status").textContent = "Loading reports…";
  $("#status").classList.remove("error");
  document.getElementById(view).setAttribute("aria-busy", "true");
  try {
    const render = await loaders[view]();
    if (sequence !== state.sequence) return;
    render();
    document.getElementById(view).removeAttribute("aria-busy");
    $("#status").textContent =
      view === "today"
        ? "Today in UTC · Recent trips from the last 30 days"
        : `Last ${state.days} days · UTC`;
  } catch (error) {
    if (sequence !== state.sequence) return;
    document.getElementById(view).removeAttribute("aria-busy");
    document.getElementById(view).hidden = true;
    $("#status").textContent = `Unable to load report: ${error.message}`;
    $("#status").classList.add("error");
  }
}
document
  .querySelectorAll("[data-view]")
  .forEach((x) => x.addEventListener("click", () => show(x.dataset.view)));
document
  .querySelectorAll("[data-go]")
  .forEach((x) => x.addEventListener("click", () => show(x.dataset.go)));
document.querySelectorAll("[data-days]").forEach((x) =>
  x.addEventListener("click", () => {
    state.days = Number(x.dataset.days);
    document.querySelectorAll("[data-days]").forEach((y) => {
      const active = x === y;
      y.classList.toggle("selected", active);
      y.setAttribute("aria-pressed", String(active));
    });
    show(state.view);
  }),
);
$("#car").addEventListener("change", (e) => {
  state.car = e.target.value;
  show(state.view);
});
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("/mobile/sw.js", { scope: "/mobile/" })
      .catch((error) =>
        console.error("Service worker registration failed", error),
      ),
  );
fetch("/mobile/api/cars")
  .then(async (response) => {
    if (!response.ok) throw new Error("Vehicle list unavailable");
    return response.json();
  })
  .then((cars) => {
    $("#car").insertAdjacentHTML(
      "beforeend",
      cars
        .map((c) => `<option value="${c.id}">${escape(c.name)}</option>`)
        .join(""),
    );
    return show("today");
  })
  .catch((error) => {
    $("#status").textContent = error.message;
    $("#status").classList.add("error");
  });
