import { parseWeatherResponse } from "@/lib/weather-response";

export async function GET() {
  try {
    const query = new URLSearchParams({
      latitude: "40.4775", longitude: "-104.9014",
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch",
      timezone: "America/Denver", forecast_days: "7",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Forecast unavailable");
    const forecast = parseWeatherResponse(await response.json());
    // Cache the upstream fetch, not a second response layer with a separate age.
    return Response.json({ forecast }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Weather temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
