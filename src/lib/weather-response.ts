import type { Forecast } from "./weather";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid weather response");
  return value as Record<string, unknown>;
}
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
export function parseWeatherResponse(value: unknown): Forecast {
  const result = object(value), current = object(result.current), daily = object(result.daily);
  const temperature = number(current.temperature_2m), code = number(current.weather_code);
  if (temperature === null || code === null || typeof current.time !== "string") throw new Error("Current weather is unavailable");
  const columns = ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max"];
  if (!Array.isArray(daily.time) || daily.time.length < 7 || columns.some(key => !Array.isArray(daily[key]) || (daily[key] as unknown[]).length < 7)) throw new Error("Incomplete daily forecast");
  return { location: "Windsor, Colorado", observedAt: current.time, current: { temperature, code, feelsLike: number(current.apparent_temperature), wind: number(current.wind_speed_10m) }, days: daily.time.slice(0, 7).map((date, index) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid forecast date");
    const values = columns.map(key => number((daily[key] as unknown[])[index]));
    return { date, code: values[0], high: values[1], low: values[2], precipitation: values[3] !== null && values[3] >= 0 && values[3] <= 100 ? values[3] : null };
  }) };
}
