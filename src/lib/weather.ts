export type ForecastDay = { date: string; code: number | null; high: number | null; low: number | null; precipitation: number | null };
export type Forecast = { location: string; observedAt: string; current: { temperature: number; feelsLike: number | null; code: number; wind: number | null }; days: ForecastDay[] };
export function weatherDescription(code: number | null) {
  const names: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Rain", 63: "Rain", 65: "Rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Snow", 73: "Snow", 75: "Snow", 77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Showers", 85: "Snow showers", 86: "Snow showers", 95: "Thunderstorms", 96: "Storms with hail", 99: "Storms with hail" };
  return code === null ? "Unavailable" : names[code] ?? "Unavailable";
}
export function weatherIcon(code: number | null) {
  if (weatherDescription(code) === "Unavailable") return "—";
  if (code === 0 || code === 1) return "☀";
  if (code === 2) return "⛅";
  if (code === 3 || code === 45 || code === 48) return "☁";
  if (code !== null && code >= 95) return "⛈";
  if (code !== null && ((code >= 71 && code <= 77) || code === 85 || code === 86)) return "❄";
  return code === null ? "—" : "☂";
}
export const degrees = (value: number | null) => value === null ? "—" : `${Math.round(value)}°`;
