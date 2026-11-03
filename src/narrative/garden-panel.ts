/** The garden panel (markup in src/render.ts `gardenPanel()`): the previous
 * page's "Make the garden yours" dock, now a round button in the reading
 * ruler that opens a panel above it, on every layout. Two widgets:
 * - Play with the sky: the hour (a slider; "Use my clock"), the weather
 *   (a preset, or live from Open-Meteo for the place the time zone names,
 *   or the exact position when the visitor asks for it), and the season,
 *   which follows the date and the hemisphere under "Now".
 * - Tend the garden: plant a tree on the front terrace or by clicking a
 *   terrace, turn the garden, and choose the drawing quality.
 * The scene mount keeps the state (src/narrative/scene-mount.ts
 * `GardenScene`), so this module only reads and writes it. Nothing is
 * fetched and no permission is asked until the visitor presses Live or
 * Use my exact location. */
import { getLocale, onLocaleChange } from "../i18n";
import type { Season } from "../scene";
import { MAX_TREES } from "./model";
import { currentWeather, placeFromDevice, placeFromTimeZone, presets, type Place, type Weather, type WeatherKind } from "../weather";
import type { QualityChoice } from "./preferences";
import type { GardenScene } from "./scene-mount";

export interface GardenPanel {
  destroy(): void;
}

/** Live weather is read again this often while the panel shows it. */
const REFRESH_MS = 15 * 60 * 1000;

export function createGardenPanel(scene: GardenScene, root: Document = document): GardenPanel | null {
  const dock = root.querySelector<HTMLDetailsElement>(".garden");
  if (!dock) return null;
  const summary = dock.querySelector<HTMLElement>("summary")!;
  const panel = dock.querySelector<HTMLElement>(".garden-panel")!;
  const status = root.querySelector<HTMLElement>("[data-garden-status]");
  const hourInput = dock.querySelector<HTMLInputElement>("[data-hour]")!;
  const hourReadout = dock.querySelector<HTMLElement>("[data-hour-readout]")!;
  const skyReport = dock.querySelector<HTMLElement>("[data-sky-report]")!;
  const seasonReport = dock.querySelector<HTMLElement>("[data-season-report]")!;
  const treeCount = dock.querySelector<HTMLElement>("[data-tree-count]")!;
  const plantMode = dock.querySelector<HTMLButtonElement>("[data-plant-mode]")!;
  const plantOne = dock.querySelector<HTMLButtonElement>("[data-plant-one]")!;
  const turn = dock.querySelector<HTMLButtonElement>("[data-turn]")!;
  const weatherChips = [...dock.querySelectorAll<HTMLButtonElement>("button[data-weather]")];
  const seasonChips = [...dock.querySelectorAll<HTMLButtonElement>("button[data-season]")];
  const qualityChips = [...dock.querySelectorAll<HTMLButtonElement>("button[data-quality]")];
  const $ = <E extends HTMLElement>(selector: string) => dock.querySelector<E>(selector);

  // The last English written to each field: localization rewrites the text
  // nodes, so the DOM cannot be compared with the next value directly.
  const written = new WeakMap<HTMLElement, string>();
  const write = (el: HTMLElement | null, text: string) => {
    if (!el || written.get(el) === text) return;
    written.set(el, text);
    el.textContent = text;
  };
  const press = (buttons: HTMLButtonElement[], key: string, value: string) =>
    buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset[key] === value)));
  /** Announced from a live region outside the panel, so it is heard while
   * the panel is closed; the same text twice is announced twice. */
  function announce(text: string) {
    if (!status) return;
    status.textContent = "";
    status.textContent = text;
  }

  /* ---------- The hour ---------- */
  function clockHour() {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.round((h < 5 ? 23 : Math.min(h, 23)) * 4) / 4;
  }
  function formatHour(h: number) {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    try {
      return new Intl.DateTimeFormat(getLocale(), { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hh, mm));
    } catch {
      return `${hh}:${String(mm).padStart(2, "0")}`;
    }
  }
  function showHour(h: number) {
    hourInput.value = String(h);
    const text = formatHour(h);
    hourReadout.textContent = text;
    hourInput.setAttribute("aria-valuetext", text);
  }
  function setHour(h: number) {
    showHour(h);
    scene.setHour(h);
  }
  const onHourInput = () => setHour(Number(hourInput.value));
  const onHourNow = () => {
    setHour(clockHour());
    announce(`Light set to ${formatHour(clockHour())}.`);
  };
  hourInput.addEventListener("input", onHourInput);
  $("[data-hour-now]")?.addEventListener("click", onHourNow);
  showHour(scene.atmosphere().hour);

  /* ---------- The weather: a preset, or live from the visitor's place ---------- */
  let place: Place | null = null;
  let live: Weather | null = null;
  let weatherMode: "live" | WeatherKind = scene.atmosphere().weather.kind;
  let refresh = 0;
  function applyWeather() {
    const w = weatherMode === "live" ? (live ?? presets.partly) : presets[weatherMode];
    scene.setWeather(w);
    press(weatherChips, "weather", weatherMode);
    if (weatherMode !== "live") write(skyReport, `Previewing ${w.label.toLowerCase()}.`);
    else if (live && place) write(skyReport, `${live.label}, ${Math.round(live.temperature ?? 0)}°C in ${place.name}.`);
    clearInterval(refresh);
    if (weatherMode === "live" && place) refresh = window.setInterval(() => { if (place && !root.hidden) loadWeather(place).catch(() => {}); }, REFRESH_MS);
  }
  async function loadWeather(from: Place) {
    live = await currentWeather(from);
    place = from;
    applyWeather();
    applySeason();
  }
  async function startWeather() {
    write(skyReport, "Looking up the weather");
    try {
      let granted = false;
      try {
        granted = (await navigator.permissions?.query({ name: "geolocation" }))?.state === "granted";
      } catch { /* Permissions API unavailable. */ }
      const from = granted ? await placeFromDevice() : await placeFromTimeZone();
      if (weatherMode !== "live") return;
      if (!from) {
        write(skyReport, "Your time zone doesn’t name a city. Use your exact location for live weather.");
        applyWeather();
        return;
      }
      await loadWeather(from);
    } catch {
      if (weatherMode !== "live") return;
      write(skyReport, "Live weather isn’t available right now.");
      applyWeather();
    }
  }
  const onWeatherClick = (event: Event) => {
    const mode = (event.currentTarget as HTMLButtonElement).dataset.weather as "live" | WeatherKind;
    weatherMode = mode;
    if (mode === "live" && !live) void startWeather();
    else applyWeather();
  };
  weatherChips.forEach(b => b.addEventListener("click", onWeatherClick));
  const onLocate = async () => {
    write(skyReport, "Finding your location");
    try {
      weatherMode = "live";
      await loadWeather(await placeFromDevice());
    } catch {
      write(skyReport, place ? `Location wasn’t shared. Showing ${place.name}.` : "Location wasn’t shared.");
      applyWeather();
    }
  };
  $("[data-locate]")?.addEventListener("click", onLocate);
  press(weatherChips, "weather", weatherMode);

  /* ---------- The season: chosen, or the date's in the place's hemisphere ---------- */
  let seasonMode: "now" | Season = scene.atmosphere().season;
  function seasonNow(): Season {
    const north: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
    const s = north[new Date().getMonth()];
    if (!place || place.latitude >= 0) return s;
    return ({ spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" } as const)[s];
  }
  function applySeason() {
    const s = seasonMode === "now" ? seasonNow() : seasonMode;
    scene.setSeason(s);
    press(seasonChips, "season", seasonMode);
    const name = s[0].toUpperCase() + s.slice(1);
    write(seasonReport, seasonMode !== "now" ? `Previewing ${s}.` : place ? `${name} in ${place.name}.` : `${name}.`);
  }
  const onSeasonClick = (event: Event) => {
    seasonMode = (event.currentTarget as HTMLButtonElement).dataset.season as typeof seasonMode;
    applySeason();
  };
  seasonChips.forEach(b => b.addEventListener("click", onSeasonClick));
  press(seasonChips, "season", seasonMode);

  /* ---------- Planting and turning ---------- */
  let plantingOn = false;
  function setPlanting(on: boolean) {
    plantingOn = on;
    plantMode.setAttribute("aria-pressed", String(on));
    write(plantMode, on ? "Planting: click a terrace" : "Plant by clicking");
    scene.setPlanting(on);
  }
  // `planted` is false when the count is only shown, as after a rebuild.
  function counted(n: number, planted = true) {
    write(treeCount, `${n} of ${MAX_TREES} trees`);
    const full = n >= MAX_TREES;
    plantMode.disabled = full || !scene.live();
    plantOne.disabled = full || !scene.live();
    if (full) {
      if (plantingOn) setPlanting(false);
      if (planted) announce(`The garden is full. ${MAX_TREES} trees planted.`);
    } else if (planted) announce(`Tree planted. ${n} of ${MAX_TREES}.`);
  }
  const onPlantMode = () => setPlanting(!plantingOn);
  const onPlantOne = () => {
    const n = scene.plant();
    if (n !== null) counted(n);
  };
  const onTurn = () => scene.rotate();
  plantMode.addEventListener("click", onPlantMode);
  plantOne.addEventListener("click", onPlantOne);
  turn.addEventListener("click", onTurn);
  const offPlanted = scene.onPlanted(n => {
    if (n < 0) announce("That spot isn’t a terrace. Try a flat surface.");
    else counted(n);
  });

  /* ---------- Quality ---------- */
  const onQualityClick = (event: Event) => {
    scene.setQuality((event.currentTarget as HTMLButtonElement).dataset.quality as QualityChoice);
  };
  qualityChips.forEach(b => b.addEventListener("click", onQualityClick));

  /* ---------- Exploring ---------- */
  // Its code loads only when pressed (src/narrative/explore.ts). Exploring
  // asks for the live drawing if stills are shown; it never turns sound on.
  const exploreButton = $<HTMLButtonElement>("[data-explore]");
  const failed = () => document.documentElement.dataset.renderer === "failed";
  const onExplore = async () => {
    if (failed()) { announce("The garden can’t be explored here. Still images are shown instead."); return; }
    if (exploreButton) exploreButton.disabled = true;
    try {
      await scene.explore();
    } finally {
      sync();
    }
    if (!scene.exploring()) announce("The garden can’t be explored here. Still images are shown instead.");
  };
  exploreButton?.addEventListener("click", onExplore);

  /* ---------- The scene's state ---------- */
  function sync() {
    const live = scene.live();
    press(qualityChips, "quality", scene.quality());
    counted(scene.trees(), false);
    turn.disabled = !live;
    if (exploreButton) exploreButton.disabled = failed() || scene.exploring();
    if (!live && plantingOn) setPlanting(false);
  }
  const offState = scene.onState(sync);
  sync();

  /* ---------- Opening and closing ---------- */
  // Escape closes (and ends planting) and returns focus; a press elsewhere closes.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (plantingOn) setPlanting(false);
    if (!dock.open) return;
    dock.open = false;
    summary.focus();
  };
  const onOutside = (event: Event) => {
    if (dock.open && !dock.contains(event.target as Node)) dock.open = false;
  };
  root.addEventListener("keydown", onKey);
  root.addEventListener("pointerdown", onOutside, true);
  const offLocale = onLocaleChange(() => showHour(Number(hourInput.value)));

  return {
    destroy() {
      hourInput.removeEventListener("input", onHourInput);
      $("[data-hour-now]")?.removeEventListener("click", onHourNow);
      $("[data-locate]")?.removeEventListener("click", onLocate);
      weatherChips.forEach(b => b.removeEventListener("click", onWeatherClick));
      seasonChips.forEach(b => b.removeEventListener("click", onSeasonClick));
      qualityChips.forEach(b => b.removeEventListener("click", onQualityClick));
      plantMode.removeEventListener("click", onPlantMode);
      plantOne.removeEventListener("click", onPlantOne);
      turn.removeEventListener("click", onTurn);
      exploreButton?.removeEventListener("click", onExplore);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("pointerdown", onOutside, true);
      clearInterval(refresh);
      offPlanted();
      offState();
      offLocale();
      if (plantingOn) setPlanting(false);
      panel.hidden = false;
    },
  };
}
