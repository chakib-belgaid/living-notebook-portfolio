/* Current weather from Open-Meteo (https://open-meteo.com, CC BY 4.0).
   Without asking for permission, the place is approximated from the
   browser's time zone ("Europe/Paris" → Paris). A visitor can share their
   exact position instead. */

export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

export interface Weather {
  kind: WeatherKind;
  /** 0–1 share of the sky covered by cloud. */
  cloud: number;
  /** 0–1 strength of rain or snow. */
  precip: number;
  /** km/h, used for cloud drift and rain slant. */
  wind: number;
  temperature?: number;
  label: string;
}

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

export const presets: Record<WeatherKind, Weather> = {
  clear: { kind: "clear", cloud: 0.04, precip: 0, wind: 8, label: "Clear" },
  partly: {
    kind: "partly",
    cloud: 0.4,
    precip: 0,
    wind: 12,
    label: "A few clouds",
  },
  cloudy: { kind: "cloudy", cloud: 0.9, precip: 0, wind: 14, label: "Overcast" },
  fog: { kind: "fog", cloud: 0.6, precip: 0, wind: 4, label: "Fog" },
  drizzle: {
    kind: "drizzle",
    cloud: 0.85,
    precip: 0.3,
    wind: 10,
    label: "Drizzle",
  },
  rain: { kind: "rain", cloud: 0.95, precip: 0.7, wind: 18, label: "Rain" },
  snow: { kind: "snow", cloud: 0.9, precip: 0.6, wind: 8, label: "Snow" },
  storm: {
    kind: "storm",
    cloud: 1,
    precip: 1,
    wind: 30,
    label: "Thunderstorm",
  },
};

/** WMO weather interpretation codes, as used by Open-Meteo. */
function fromCode(code: number, cloudCover: number, wind: number): Weather {
  const cloud = Math.min(Math.max(cloudCover / 100, 0), 1);
  const make = (kind: WeatherKind, precip: number, label: string): Weather => ({
    kind,
    cloud: kind === "clear" || kind === "partly" ? cloud : Math.max(cloud, 0.75),
    precip,
    wind,
    label,
  });
  if (code === 0) return make("clear", 0, "Clear");
  if (code === 1) return make("partly", 0, "Mostly clear");
  if (code === 2) return make("partly", 0, "Partly cloudy");
  if (code === 3) return make("cloudy", 0, "Overcast");
  if (code === 45 || code === 48) return make("fog", 0, "Fog");
  if (code >= 51 && code <= 57) return make("drizzle", 0.3, "Drizzle");
  if (code === 61 || code === 80) return make("rain", 0.4, "Light rain");
  if (code === 63 || code === 81) return make("rain", 0.65, "Rain");
  if (code === 65 || code === 82) return make("rain", 0.95, "Heavy rain");
  if (code === 66 || code === 67) return make("rain", 0.6, "Freezing rain");
  if (code === 71 || code === 85) return make("snow", 0.35, "Light snow");
  if (code === 73) return make("snow", 0.6, "Snow");
  if (code === 75 || code === 86) return make("snow", 0.9, "Heavy snow");
  if (code === 77) return make("snow", 0.3, "Snow grains");
  if (code >= 95) return make("storm", 1, "Thunderstorm");
  return make("partly", 0, "Partly cloudy");
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} from ${url}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Approximate place from the time zone. Returns null for zones like UTC. */
export async function placeFromTimeZone(): Promise<Place | null> {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const city = zone.split("/").pop()?.replace(/_/g, " ");
  if (!city || !zone.includes("/") || zone.startsWith("Etc/")) return null;
  const data = await getJson<{
    results?: { name: string; latitude: number; longitude: number }[];
  }>(
    `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(city)}`,
  );
  const hit = data.results?.[0];
  return hit
    ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude }
    : null;
}

/** Ask the browser for the visitor's position. */
export function placeFromDevice(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator))
      return reject(new Error("Location isn’t available in this browser."));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          name: "your location",
          latitude: Math.round(p.coords.latitude * 100) / 100,
          longitude: Math.round(p.coords.longitude * 100) / 100,
        }),
      (e) => reject(e),
      { maximumAge: 30 * 60 * 1000, timeout: 10000 },
    );
  });
}

export async function currentWeather(place: Place): Promise<Weather> {
  const data = await getJson<{
    current: {
      temperature_2m: number;
      weather_code: number;
      cloud_cover: number;
      wind_speed_10m: number;
    };
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m&timezone=auto`,
  );
  const c = data.current;
  return {
    ...fromCode(c.weather_code, c.cloud_cover, c.wind_speed_10m),
    temperature: c.temperature_2m,
  };
}

/** 0 = new moon, 0.5 = full moon. */
export function moonPhase(date = new Date()) {
  const synodic = 29.530588853;
  const reference = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - reference) / 86400000;
  return (((days / synodic) % 1) + 1) % 1;
}
