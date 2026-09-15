import type { Forecast } from "@/lib/weather";

export async function GET() {
  const location = process.env.WEATHER_LOCATION;
  if (!location) return Response.json({ error: "Weather location needed" }, { status: 503 });
  try {
    const placeResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!placeResponse.ok) throw new Error("Location unavailable");
    const places = await placeResponse.json();
    const place = places.results?.[0];
    if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) throw new Error("Location unavailable");
    const query = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), daily: "weather_code,temperature_2m_max,temperature_2m_min", temperature_unit: "fahrenheit", timezone: "auto", forecast_days: "1" });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Forecast unavailable");
    const { daily } = await response.json();
    const forecast: Forecast = { location: place.name, date: daily?.time?.[0], high: daily?.temperature_2m_max?.[0], low: daily?.temperature_2m_min?.[0], code: daily?.weather_code?.[0], fetchedAt: new Date().toISOString() };
    if (!forecast.date || ![forecast.high, forecast.low, forecast.code].every(Number.isFinite)) throw new Error("Forecast unavailable");
    return Response.json({ forecast }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch { return Response.json({ error: "Forecast temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
